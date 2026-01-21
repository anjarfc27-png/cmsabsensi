-- 069_hapus_denda_telat.sql
-- Menghilangkan denda keterlambatan dari perhitungan payroll

-- 1. Reset denda yang sudah ada di ringkasan bulanan
UPDATE public.monthly_attendance_summary SET deductions = 0;

-- 2. Update Fungsi calculate_monthly_attendance_summary 
-- Memastikan kolom 'deductions' di-reset ke 0 saat kalkulasi ulang otomatis
CREATE OR REPLACE FUNCTION public.calculate_monthly_attendance_summary(
  p_user_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_total_present INTEGER;
  v_total_late INTEGER;
  v_total_late_minutes INTEGER;
  v_total_absent INTEGER;
  v_total_leave INTEGER;
  v_total_overtime_hours DECIMAL(5,2);
  v_working_days INTEGER;
BEGIN
  -- Hitung tanggal awal dan akhir bulan
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (date_trunc('month', v_start_date) + interval '1 month - 1 day')::date;

  -- Hitung hari kerja (Senin-Jumat)
  SELECT count(*)
  INTO v_working_days
  FROM generate_series(v_start_date, v_end_date, '1 day') as day
  WHERE extract(isodow from day) < 6;

  -- Agregasi data kehadiran
  SELECT 
    COUNT(*) FILTER (WHERE status = 'present' OR status = 'late'),
    COUNT(*) FILTER (WHERE is_late = true),
    COALESCE(SUM(late_minutes), 0),
    COUNT(*) FILTER (WHERE status = 'leave' OR status = 'sick')
  INTO 
    v_total_present,
    v_total_late,
    v_total_late_minutes,
    v_total_leave
  FROM public.attendances
  WHERE user_id = p_user_id
    AND date >= v_start_date 
    AND date <= v_end_date;

  -- Hitung absen (Hari Kerja - (Hadir + Izin))
  v_total_absent := GREATEST(0, v_working_days - (v_total_present + v_total_leave));

  -- Agregasi lembur
  SELECT 
    COALESCE(SUM(duration_hours), 0)
  INTO v_total_overtime_hours
  FROM public.overtime_requests
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND date >= v_start_date
    AND date <= v_end_date;

  -- Upsert ke monthly_attendance_summary
  -- Set deductions = 0 secara eksplisit untuk menghapus denda telat otomatis
  INSERT INTO public.monthly_attendance_summary (
    user_id, month, year,
    total_working_days,
    total_present,
    total_late,
    total_late_minutes,
    total_absent,
    total_leave_days,
    total_overtime_hours,
    deductions,
    updated_at
  ) VALUES (
    p_user_id, p_month, p_year,
    v_working_days,
    v_total_present,
    v_total_late,
    v_total_late_minutes,
    v_total_absent,
    v_total_leave,
    v_total_overtime_hours,
    0, -- Denda di-set ke 0
    now()
  )
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET
    total_working_days = EXCLUDED.total_working_days,
    total_present = EXCLUDED.total_present,
    total_late = EXCLUDED.total_late,
    total_late_minutes = EXCLUDED.total_late_minutes,
    total_absent = EXCLUDED.total_absent,
    total_leave_days = EXCLUDED.total_leave_days,
    total_overtime_hours = EXCLUDED.total_overtime_hours,
    deductions = 0, -- Reset denda ke 0 jika ada kalkulasi ulang
    updated_at = now();

END;
$$;


-- 3. Update Fungsi generate_employee_payroll
-- Menggunakan calculate_pph21_ter dan memaksa late_deduction = 0
CREATE OR REPLACE FUNCTION public.generate_employee_payroll(
  p_payroll_run_id UUID,
  p_user_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payroll_detail_id UUID;
  v_salary RECORD;
  v_summary RECORD;
  v_gross_salary DECIMAL;
  v_total_allowances DECIMAL;
  v_total_deductions DECIMAL;
  v_net_salary DECIMAL;
  v_pph21_ter_amount DECIMAL;
BEGIN
  -- 1. Pastikan summary kehadiran diperbarui dan denda di-reset
  PERFORM public.calculate_monthly_attendance_summary(p_user_id, p_month, p_year);

  -- 2. Ambil data gaji aktif
  SELECT * INTO v_salary
  FROM public.employee_salaries
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF v_salary IS NULL THEN
    RAISE NOTICE 'No active salary found for user %, skipping.', p_user_id;
    RETURN NULL;
  END IF;
  
  -- 3. Ambil ringkasan kehadiran
  SELECT * INTO v_summary
  FROM public.monthly_attendance_summary
  WHERE user_id = p_user_id AND month = p_month AND year = p_year;
  
  -- 4. Hitung Komponen
  v_total_allowances := COALESCE(v_salary.transport_allowance, 0) + 
                        COALESCE(v_salary.meal_allowance, 0) + 
                        COALESCE(v_salary.position_allowance, 0) + 
                        COALESCE(v_salary.housing_allowance, 0) + 
                        COALESCE(v_salary.other_allowances, 0);
  
  -- Gaji Kotor = Pokok + Tunjangan + Lembur
  v_gross_salary := v_salary.base_salary + v_total_allowances + COALESCE(v_summary.total_overtime_pay, 0);
  
  -- Hitung Pajak PPh 21 dengan metode TER
  v_pph21_ter_amount := public.calculate_pph21_ter(v_gross_salary, v_salary.ptkp_status);
  
  -- Hitung Potongan (Abaikan COALESCE(v_summary.deductions, 0) untuk denda telat)
  v_total_deductions := 
    0 + -- POTONGAN TELAT DIPAKSA 0
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100) +
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100) +
    v_pph21_ter_amount;
  
  v_net_salary := v_gross_salary - v_total_deductions;
  
  -- 5. Insert atau Update detail payroll
  INSERT INTO public.payroll_details (
    payroll_run_id, user_id,
    working_days, present_days, late_count, late_minutes, absent_days, leave_days,
    overtime_hours, overtime_pay,
    base_salary, transport_allowance, meal_allowance, position_allowance, 
    housing_allowance, other_allowances, total_allowances, gross_salary,
    late_deduction, absent_deduction,
    bpjs_kesehatan_employee, bpjs_tk_employee, pph21,
    total_deductions, net_salary,
    bpjs_kesehatan_employer, bpjs_tk_employer, total_employer_cost
  ) VALUES (
    p_payroll_run_id, p_user_id,
    COALESCE(v_summary.total_working_days, 0),
    COALESCE(v_summary.total_present, 0),
    COALESCE(v_summary.total_late, 0),
    COALESCE(v_summary.total_late_minutes, 0),
    COALESCE(v_summary.total_absent, 0),
    COALESCE(v_summary.total_leave_days, 0),
    COALESCE(v_summary.total_overtime_hours, 0),
    COALESCE(v_summary.total_overtime_pay, 0),
    v_salary.base_salary,
    COALESCE(v_salary.transport_allowance, 0),
    COALESCE(v_salary.meal_allowance, 0),
    COALESCE(v_salary.position_allowance, 0),
    COALESCE(v_salary.housing_allowance, 0),
    COALESCE(v_salary.other_allowances, 0),
    v_total_allowances,
    v_gross_salary,
    0, -- LATE DEDUCTION PAKSA 0
    0, 
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100),
    v_pph21_ter_amount,
    v_total_deductions,
    v_net_salary,
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employer_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employer_rate / 100),
    (v_salary.base_salary * (v_salary.bpjs_kesehatan_employer_rate + v_salary.bpjs_tk_employer_rate) / 100)
  )
  ON CONFLICT (payroll_run_id, user_id) DO UPDATE SET
    working_days = EXCLUDED.working_days,
    present_days = EXCLUDED.present_days,
    overtime_hours = EXCLUDED.overtime_hours,
    overtime_pay = EXCLUDED.overtime_pay,
    total_allowances = EXCLUDED.total_allowances,
    gross_salary = EXCLUDED.gross_salary,
    late_deduction = 0, -- Reset jika sudah ada nilai lama
    pph21 = EXCLUDED.pph21,
    total_deductions = EXCLUDED.total_deductions,
    net_salary = EXCLUDED.net_salary,
    updated_at = now()
  RETURNING id INTO v_payroll_detail_id;
  
  RETURN v_payroll_detail_id;
END;
$$;
