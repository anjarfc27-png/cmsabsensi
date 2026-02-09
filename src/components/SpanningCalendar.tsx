
import React, { useMemo } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    isBefore,
    isAfter,
    parseISO,
    differenceInDays,
    min,
    max,
    isValid
} from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Agenda } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    color: string;
    type: 'agenda' | 'holiday';
    raw?: any;
}

interface SpanningCalendarProps {
    currentDate: Date;
    agendas: Agenda[];
    holidays: any[];
    onSelectDay: (day: Date) => void;
    onSelectEvent: (event: CalendarEvent) => void;
    selectedDay: Date;
}

export function SpanningCalendar({
    currentDate,
    agendas,
    holidays,
    onSelectDay,
    onSelectEvent,
    selectedDay
}: SpanningCalendarProps) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weeks = useMemo(() => {
        const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        const weekRows = [];
        for (let i = 0; i < days.length; i += 7) {
            weekRows.push(days.slice(i, i + 7));
        }
        return weekRows;
    }, [calendarStart, calendarEnd]);

    const events: CalendarEvent[] = useMemo(() => {
        const agendaEvents: CalendarEvent[] = agendas.map(a => ({
            id: a.id,
            title: a.title,
            start: parseISO(a.start_time),
            end: parseISO(a.end_time),
            color: 'bg-emerald-500/90 text-white',
            type: 'agenda',
            raw: a
        }));

        const holidayEvents: CalendarEvent[] = holidays.map(h => ({
            id: h.id,
            title: h.name,
            start: parseISO(h.date),
            end: parseISO(h.date),
            color: 'bg-rose-500/90 text-white',
            type: 'holiday',
            raw: h
        }));

        return [...agendaEvents, ...holidayEvents].sort((a, b) => {
            // Sort by start date, then by duration (longer first)
            const dateDiff = a.start.getTime() - b.start.getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.end.getTime() - a.end.getTime() - (a.end.getTime() - a.start.getTime());
        });
    }, [agendas, holidays]);

    const renderWeekEvents = (week: Date[]) => {
        const weekStart = week[0];
        const weekEnd = week[6];

        // Filter events that fall into this week
        const weekEvents = events.filter(e =>
            (isBefore(e.start, addDays(weekEnd, 1)) && isAfter(e.end, addDays(weekStart, -1)))
        );

        // Map events to slots
        const slots: (CalendarEvent | null)[][] = []; // [row][dayIndex]

        weekEvents.forEach(event => {
            const eventStart = max([event.start, weekStart]);
            const eventEnd = min([event.end, weekEnd]);

            const startIdx = differenceInDays(eventStart, weekStart);
            const span = differenceInDays(min([eventEnd, weekEnd]), eventStart) + 1;

            // Find first available slot
            let slotIndex = 0;
            while (true) {
                if (!slots[slotIndex]) slots[slotIndex] = new Array(7).fill(null);
                let available = true;
                for (let i = startIdx; i < startIdx + span; i++) {
                    if (slots[slotIndex][i]) {
                        available = false;
                        break;
                    }
                }
                if (available) {
                    for (let i = startIdx; i < startIdx + span; i++) {
                        slots[slotIndex][i] = event;
                    }
                    break;
                }
                slotIndex++;
            }
        });

        return (
            <div className="flex-1 relative min-h-[80px] pt-7">
                {slots.slice(0, 4).map((row, rowIndex) => (
                    <div key={rowIndex} className="h-6 mb-1 relative w-full">
                        {week.map((day, dayIndex) => {
                            const event = row[dayIndex];
                            if (!event) return null;

                            // Only render the bar starting from the first day it appears in this week
                            const isEventStartOnThisDay = isSameDay(event.start, day) || dayIndex === 0;
                            if (!isEventStartOnThisDay) return null;

                            const eventEndInWeek = min([event.end, weekEnd]);
                            const eventSpan = differenceInDays(eventEndInWeek, day) + 1;

                            const isContinuingRight = isAfter(event.end, weekEnd);
                            const isContinuingLeft = isBefore(event.start, weekStart);

                            return (
                                <div
                                    key={dayIndex}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectEvent(event);
                                    }}
                                    className={cn(
                                        "absolute h-5 flex items-center px-2 text-[10px] font-bold cursor-pointer transition-all hover:brightness-95 hover:scale-[1.01] z-10",
                                        event.color,
                                        !isContinuingLeft && "rounded-l-lg ml-1",
                                        !isContinuingRight && "rounded-r-lg mr-1",
                                        "shadow-sm border border-black/5"
                                    )}
                                    style={{
                                        left: `${(dayIndex / 7) * 100}%`,
                                        width: `${(eventSpan / 7) * 100}%`,
                                    }}
                                >
                                    <span className="truncate w-full leading-none">
                                        {dayIndex === 0 || isSameDay(event.start, day) ? event.title : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ))}
                {slots.length > 4 && (
                    <div className="absolute bottom-0 right-1 text-[9px] font-black text-slate-400">
                        {slots.length - 4}+ more
                    </div>
                )}
            </div>
        );
    };

    return (
        <TooltipProvider>
            <div className="w-full bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
                {/* Header Days Label */}
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, i) => (
                        <div key={day} className={cn(
                            "py-3 text-center text-[10px] font-black uppercase tracking-[0.2em]",
                            i === 5 || i === 6 ? "text-rose-400" : "text-slate-400"
                        )}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-rows-5 divide-y divide-slate-100 min-h-[600px]">
                    {weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="grid grid-cols-7 divide-x divide-slate-50 relative group">
                            {/* Day Grid Background */}
                            {week.map((day, dayIdx) => {
                                const isCurrentMonth = isSameMonth(day, monthStart);
                                const isToday = isSameDay(day, new Date());
                                const isSelected = isSameDay(day, selectedDay);
                                const isWeekend = dayIdx === 5 || dayIdx === 6;

                                return (
                                    <div
                                        key={dayIdx}
                                        onClick={() => onSelectDay(day)}
                                        className={cn(
                                            "min-h-[120px] p-2 transition-all cursor-pointer relative",
                                            !isCurrentMonth ? "bg-slate-50/30" : "bg-white",
                                            isSelected ? "bg-blue-50/50" : "hover:bg-blue-50/20",
                                            isWeekend && isCurrentMonth && "bg-slate-50/20"
                                        )}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className={cn(
                                                "text-xs font-black h-8 w-8 flex items-center justify-center rounded-xl transition-all",
                                                !isCurrentMonth ? "text-slate-300" : "text-slate-500",
                                                isToday ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "",
                                                isSelected && !isToday ? "bg-blue-100 text-blue-700" : "",
                                                isWeekend && isCurrentMonth && !isToday && !isSelected ? "text-rose-400" : ""
                                            )}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Spanning Events Layer */}
                            <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none flex flex-col">
                                {renderWeekEvents(week)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
}
