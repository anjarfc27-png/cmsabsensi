# 🔒 MOBILE LAYOUT LOCK SYSTEM

**Created:** 2026-01-20 15:56 WIB  
**Status:** ✅ ACTIVE

---

## 🎯 **Purpose**

Sistem ini **MELINDUNGI tampilan mobile** dari perubahan yang Anda lakukan di tampilan desktop/website.

**Kenapa ini penting:**
- Tampilan mobile sudah bagus dan optimal
- Tampilan desktop masih perlu banyak penyesuaian
- Anda bisa update desktop BEBAS tanpa merusak mobile

---

## 📁 **Files Created**

### 1. **`src/hooks/useIsMobile.ts`** 
Hook untuk detect mobile device

```tsx
import { useIsMobile } from '@/hooks/useIsMobile';

function MyComponent() {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    // Render mobile layout (LOCKED)
  } else {
    // Render desktop layout (EDITABLE)
  }
}
```

### 2. **`src/styles/mobile-locked.css`**
CSS classes yang **TERKUNCI untuk mobile**

**⚠️ DON'T TOUCH:** Classes tanpa prefix `md:`, `lg:`, `xl:`  
**✅ SAFE TO EDIT:** Classes dengan prefix `md:`, `lg:`, `xl:`

### 3. **`src/index.css`** (Modified)
Import mobile-locked.css - **JANGAN HAPUS IMPORT INI!**

---

## 🔐 **How It Works**

### **Mobile (< 768px):**
```css
/* LOCKED - Tidak terpengaruh perubahan desktop */
.mobile-locked-container { /* ... */ }
.mobile-locked-card { /* ... */ }
.mobile-locked-btn-primary { /* ... */ }
```

### **Desktop (≥ 768px):**
```css
/* EDITABLE - Bebas diubah sesuka hati */
@media (min-width: 768px) {
  .desktop-container { /* Ubah apa saja */ }
  .desktop-card { /* Bebas */ }
}
```

---

## ✅ **SAFE TO EDIT (Desktop)**

Anda **AMAN** untuk mengubah:

1. **Tailwind classes dengan breakpoint:**
   ```tsx
   className="md:w-1/2 lg:w-1/3 xl:w-1/4"  // ✅ SAFE
   className="md:p-8 lg:p-12"               // ✅ SAFE
   ```

2. **Custom CSS dalam media query:**
   ```css
   @media (min-width: 768px) {
     /* Apapun di sini AMAN */ /* ✅ SAFE */
   }
   ```

3. **Desktop-only components:**
   ```tsx
   <div className="hidden md:block">
     {/* Desktop view - Bebas edit */}
   </div>
   ```

---

## ⚠️ **DON'T TOUCH (Mobile Protected)**

**JANGAN** ubah:

1. **Base classes (tanpa breakpoint):**
   ```tsx
   className="w-full p-4 rounded-2xl"  // ❌ LOCKED
   ```

2. **Mobile-locked classes:**
   ```tsx
   className="mobile-locked-card"      // ❌ LOCKED
   className="mobile-locked-btn-primary"  // ❌ LOCKED
   ```

3. **Classes di dalam media query (max-width):**
   ```css
   @media (max-width: 767px) {
     /* Jangan ubah apapun di sini */ /* ❌ LOCKED */
   }
   ```

---

## 📱 **Breakpoints**

```tsx
Mobile:   < 768px   (LOCKED - Protected)
Tablet:   768px+    (EDITABLE)
Desktop:  1024px+   (EDITABLE)
Wide:     1280px+   (EDITABLE)
```

---

## 🎨 **Usage Examples**

### **Example 1: Conditional Rendering**

```tsx
import { useIsMobile } from '@/hooks/useIsMobile';

function MyPage() {
  const isMobile = useIsMobile();

  return (
    <div>
      {isMobile ? (
        /* Mobile Layout - LOCKED */
        <div className="mobile-locked-container">
          <h1 className="mobile-locked-title">Mobile Title</h1>
        </div>
      ) : (
        /* Desktop Layout - EDITABLE */
        <div className="desktop-container max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold">Customize me!</h1>
        </div>
      )}
    </div>
  );
}
```

### **Example 2: Responsive with Tailwind**

```tsx
function Card() {
  return (
    /* Base mobile (LOCKED) + Desktop overrides (EDITABLE) */
    <div className="
      w-full               
      p-4                  
      rounded-2xl          
      md:w-1/2             
      md:p-8               
      lg:w-1/3             
      xl:rounded-3xl       
    ">
      Content here
    </div>
  );
}
```

### **Example 3: Using Locked Classes**

```tsx
function AttendanceCard() {
  return (
    <div className="mobile-locked-card md:shadow-2xl lg:max-w-2xl">
      {/* Mobile: uses mobile-locked-card styles */}
      {/* Desktop: adds shadow-2xl and max-w-2xl */}
      
      <button className="mobile-locked-btn-primary md:w-auto lg:px-12">
        {/* Mobile: Full width button */}
        {/* Desktop: Auto width with extra padding */}
        Submit
      </button>
    </div>
  );
}
```

---

## 🚀 **Testing**

### **Test Mobile Protection:**

1. Open DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Layout should look PERFECT
5. Now edit desktop CSS
6. Refresh mobile view
7. **Mobile should NOT change!** ✅

### **Test Desktop Freedom:**

1. Desktop view (> 768px)
2. Edit any `md:`, `lg:`, `xl:` classes
3. Mobile **should NOT be affected**
4. Desktop **should change** ✅

---

## 📋 **Available Locked Classes**

### **Containers:**
- `mobile-locked-container`
- `mobile-locked-card`
- `mobile-locked-padding`
- `mobile-locked-section-gap`

### **Navigation:**
- `mobile-locked-nav`
- `mobile-locked-header`
- `mobile-locked-header-content`

### **Buttons:**
- `mobile-locked-btn-primary`
- `mobile-locked-btn-secondary`

### **Forms:**
- `mobile-locked-input`
- `mobile-locked-label`

### **Overlays:**
- `mobile-locked-modal`
- `mobile-locked-modal-content`
- `mobile-locked-camera`
- `mobile-locked-camera-video`

### **Typography:**
- `mobile-locked-title`
- `mobile-locked-subtitle`
- `mobile-locked-body`

### **Utilities:**
- `mobile-hidden` (hides on mobile)
- `desktop-hidden` (hides on desktop)
- `responsive-padding`
- `responsive-text-xs/sm/base/lg/xl`

---

## 🛡️ **Force Mobile Layout (Emergency)**

Jika ada masalah, gunakan class ini di root element:

```tsx
<div className="force-mobile-layout">
  {/* This will FORCE mobile layout on mobile devices */}
  {/* Use ONLY if something breaks */}
</div>
```

---

## ⚡ **Quick Commands**

### **Add mobile-only content:**
```tsx
<div className="desktop-hidden">
  Mobile only
</div>
```

### **Add desktop-only content:**
```tsx
<div className="mobile-hidden">
  Desktop only
</div>
```

### **Hybrid content:**
```tsx
<h1 className="text-xl md:text-3xl lg:text-5xl">
  {/* Mobile: text-xl */}
  {/* Tablet: text-3xl */}
  {/* Desktop: text-5xl */}
  Responsive Title
</h1>
```

---

## 🔄 **Rollback**

Jika ingin disable protection:

1. **Remove import:**
   ```css
   /* In src/index.css - COMMENT OUT: */
   /* @import './styles/mobile-locked.css'; */
   ```

2. **Delete files:**
   - `src/hooks/useIsMobile.ts`
   - `src/styles/mobile-locked.css`

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

---

## 📝 **Rules Summary**

### ✅ **DO:**
- Edit anything with `md:`, `lg:`, `xl:` prefix
- Add new desktop-only components
- Modify desktop layout freely
- Test on mobile after desktop changes

### ❌ **DON'T:**
- Edit base classes (without breakpoints) 
- Touch `mobile-locked-*` classes
- Modify CSS inside `@media (max-width: 767px)`
- Remove mobile-locked.css import

---

## 🎯 **Goals Achieved**

✅ Mobile layout is PROTECTED  
✅ Desktop layout is EDITABLE  
✅ No breaking changes when updating desktop  
✅ Easy to use and maintain  
✅ Well documented  

---

**Status:** 🟢 **ACTIVE & PROTECTING**  
**Last Updated:** 2026-01-20 15:56 WIB  
**Maintained By:** Antigravity AI Assistant
