# Design System 12.03.2026 - Implementation Guide

**For Developers & Design System Users**

This guide explains how to use the design system files and integrate them into your project.

---

## What You Have

This design system export includes three files:

| File | Purpose | Format |
|------|---------|--------|
| `STYLE-GUIDE.md` | AI-ready prompt with design philosophy and constraints | Markdown |
| `design-tokens.json` | Complete token specifications in machine-readable format | JSON |
| `design-system.css` | Production-ready CSS custom properties | CSS |

Each file serves a different purpose. Use them together for best results.

---

## File Structure

```
design-system-export/
├── STYLE-GUIDE.md          ← AI agent instructions (direct prompt format)
├── IMPLEMENTATION-GUIDE.md ← You are here (developer documentation)
├── design-tokens.json      ← Token specifications
└── design-system.css       ← Production CSS
```

### File Purposes

**STYLE-GUIDE.md** - AI Agent Instructions
- Direct prompt format for Claude, GPT, Cursor, etc.
- Contains design philosophy and implementation constraints
- Use this when asking AI to generate code

**design-tokens.json** - Machine-Readable Tokens
- Hierarchical structure with complete metadata
- For build tools, design token pipelines, automation
- Reference when you need exact token values
- Great for programmatic access

**design-system.css** - Production CSS
- All tokens as CSS custom properties
- Ready to drop into your project
- Includes utility classes and component base styles
- Best for rapid development

---

## Quick Start

### Option 1: Use CSS Variables Directly

The fastest way to get started:

1. **Copy** `design-system.css` into your project
2. **Import** it in your main stylesheet:
   ```css
   @import './design-system.css';
   ```
3. **Use** the CSS variables in your components:
   ```css
   .button {
     background: var(--color-primary);
     padding: var(--spacing-md) var(--spacing-lg);
     border-radius: var(--radius-md);
     transition: var(--transition-fast);
   }
   ```

### Option 2: Reference Tokens During Development

For more control or when building your own styles:

1. **Open** `design-tokens.json` alongside your code
2. **Look up** the exact value you need
3. **Use** it as a CSS variable in your styles

### Option 3: Integrate with AI Agents

When using AI to generate code:

1. **Provide** the `STYLE-GUIDE.md` file to the AI
2. **Ask** the AI to generate components following the guide
3. **Verify** the generated code uses CSS variables and follows the constraints

---

## Understanding Design Tokens

### What Are Tokens?

Design tokens are the **fundamental building blocks** of your design system. They define:

- Color values and their semantics
- Typography scales and font properties
- Spacing increments (based on 8px base grid)
- Shadow definitions for depth
- Border radius values for consistency
- Animation timing and easing functions

### Why Tokens Matter

1. **Consistency**: Same value used everywhere
2. **Maintainability**: Change a token once, updates everywhere
3. **Scalability**: Easy to extend or modify the system
4. **Automation**: Tokens can be generated, validated, and versioned
5. **Platform Sync**: Same tokens for web, mobile, desktop

### Token Organization

Tokens are organized hierarchically:

```
Colors
├── Brand
│   ├── Primary
│   ├── Secondary
│   └── ...
├── Semantic
│   ├── Success
│   ├── Error
│   ├── Warning
│   └── Info
└── Neutral
    ├── Gray (50-900)
    └── ...

Typography
├── Fonts
│   ├── Sans
│   └── Mono
└── Scales
    ├── H1, H2, H3, ...
    └── Body, Caption, ...

Spacing
└── Scale (xs, sm, md, lg, xl, xxl)

Animation
├── Durations
└── Easings
```

---

## Using CSS Variables

### CSS Variable Syntax

All design tokens are exposed as CSS variables following this pattern:

```
--[category]-[type]-[modifier]
```

### Examples

```css
/* Colors */
var(--color-primary)           /* Primary brand color */
var(--color-semantic-success)  /* Success state color */
var(--color-neutral-gray-500)  /* Gray shade (500 value) */

/* Typography */
var(--font-sans)               /* Primary font family */
var(--font-size-h1)            /* H1 font size */
var(--line-height-h1)          /* H1 line height */
var(--font-weight-semibold)    /* Semibold weight (600) */

/* Spacing */
var(--spacing-xs)              /* 4px - Tight spacing */
var(--spacing-md)              /* 16px - Normal spacing */
var(--spacing-lg)              /* 24px - Larger spacing */

/* Effects */
var(--radius-md)               /* 8px - Medium border radius */
var(--shadow-medium)           /* Medium elevation shadow */
var(--transition-fast)         /* 150ms transition with easing */
```

### In Your Code

```css
/* Button Component */
.button {
  /* Colors */
  background: var(--color-primary);
  color: var(--color-white);

  /* Spacing */
  padding: var(--spacing-md) var(--spacing-lg);

  /* Shape */
  border-radius: var(--radius-md);
  border: none;

  /* Typography */
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);

  /* Effects */
  box-shadow: var(--shadow-subtle);
  transition: var(--transition-fast);
}

.button:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow-medium);
  transform: translateY(-1px);
}

.button:active {
  transform: translateY(0);
  box-shadow: var(--shadow-subtle);
}

.button:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button:disabled {
  background: var(--color-neutral-gray-300);
  color: var(--color-neutral-gray-600);
  cursor: not-allowed;
  opacity: 0.6;
}
```

### Never Hardcode Values

❌ **Bad** - Hardcoded values:
```css
.button {
  background: #FF6363;
  padding: 12px 16px;
  border-radius: 8px;
}
```

✅ **Good** - CSS variables:
```css
.button {
  background: var(--color-primary);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
}
```

---

## Understanding design-tokens.json

The JSON file contains the **machine-readable token specifications** with complete metadata.

### Structure

```json
{
  "meta": {
    "title": "Design System Name",
    "version": "1.0.0",
    "extracted_date": "2025-01-15T10:30:00Z"
  },
  "colors": {
    "primary": {
      "name": "Primary Red",
      "hex": "#FF6363",
      "rgb": "255, 99, 99",
      "hsl": "0, 100%, 69%",
      "usage": "Primary actions and emphasis"
    }
  },
  "typography": { ... },
  "spacing": { ... }
}
```

### When to Use

Use `design-tokens.json` when you need to:

- **Reference exact values** - Look up the precise hex code or pixel value
- **Build tooling** - Programmatically access tokens
- **Version control** - Track changes to the design system
- **Validate tokens** - Check token completeness and consistency
- **Generate code** - Automatically create CSS, SCSS, or other formats
- **Document tokens** - Include token metadata in documentation

### Looking Up Values

To find a specific token value:

1. Open `design-tokens.json`
2. Navigate to the relevant category (colors, typography, etc.)
3. Find your token
4. Note the `hex`, `size`, or relevant property

Example - Finding color for a success button:
```json
"colors": {
  "semantic": {
    "success": {
      "name": "Success Green",
      "hex": "#13CE66",
      "usage": "Success states and confirmations"
    }
  }
}
```

Then use: `var(--color-semantic-success)` in your CSS

---

## Using With AI Agents

The design system export is optimized for use with AI coding assistants (Claude, ChatGPT, Cursor, etc.).

### Workflow

1. **Get the design system export** (you have it!)
2. **Open `STYLE-GUIDE.md`** - This is the AI-ready prompt
3. **Paste the content** into your conversation with an AI agent
4. **Add your request** - "Generate a login form using this design system"
5. **Review the code** - Verify it follows the constraints
6. **Refine as needed** - Ask for adjustments

### Example Prompt

```
[Paste the entire STYLE-GUIDE.md content here]

Now, please generate a responsive navigation bar component that:
- Supports mobile and desktop layouts
- Uses the design tokens from the system
- Includes hover and active states
- Is fully accessible with keyboard navigation
```

### What the AI Will Do

A well-instructed AI will:
- ✅ Use CSS variables from the design system
- ✅ Implement all interactive states
- ✅ Follow accessibility requirements
- ✅ Align with the design philosophy
- ✅ Use semantic HTML
- ✅ Include focus states and indicators

### Benefits

- **Consistent output** - AI generated code follows the system
- **Faster development** - Less manual styling work
- **Better quality** - Philosophy-driven design decisions
- **Maintainability** - Code uses the design tokens

### Tip: Update Your Instructions

If you frequently use AI for code generation, create a custom instruction or system prompt with the STYLE-GUIDE content. This way, all your AI requests will automatically consider the design system.

---

## Best Practices

### DO

✅ **Use CSS variables for everything**
- Colors, spacing, typography, shadows - everything
- This ensures consistency and makes updates easy

✅ **Reference tokens consistently**
- Don't recreate values
- Use the same token everywhere it applies

✅ **Implement all interactive states**
- Default, hover, active, focus, disabled
- This is required for usability and accessibility

✅ **Test with keyboard navigation**
- Use Tab to navigate
- Verify focus is always visible
- Test with screen readers

✅ **Follow the token naming pattern**
- Makes tokens predictable and discoverable
- Easier for teammates to understand

✅ **Keep the export files together**
- All three files should stay in the same directory
- They reference each other

✅ **Version your design system**
- Track changes to tokens over time
- Make updates transparent to the team

### DON'T

❌ **Don't hardcode design values**
- Never use raw hex codes in your CSS
- Never use hardcoded pixel values
- Always use variables

❌ **Don't modify the design system casually**
- Changes should be intentional and documented
- Update the tokens, not individual component styles
- Keep the system consistent

❌ **Don't skip interactive states**
- Every button needs hover/active states
- Every input needs focus state
- Every element needs disabled state

❌ **Don't ignore accessibility**
- WCAG AA is the minimum standard
- Test with real assistive technology
- Don't rely on color alone to convey information

❌ **Don't duplicate token definitions**
- If you find yourself recreating a value, it probably exists as a token
- Check the token files first

❌ **Don't mix design systems**
- Stay consistent within one system
- If you need to use a different system, use it exclusively

❌ **Don't abandon the design philosophy**
- The philosophy is the foundation
- Every decision should trace back to it

---

## Practical Examples

### Example 1: Button Component

**HTML**:
```html
<button class="button button--primary">Click me</button>
<button class="button button--primary" disabled>Disabled</button>
```

**CSS**:
```css
.button {
  /* Base styles */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  transition: var(--transition-fast);
}

/* Primary variant */
.button--primary {
  background: var(--color-primary);
  color: var(--color-white);
  box-shadow: var(--shadow-subtle);
}

.button--primary:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow-medium);
  transform: translateY(-1px);
}

.button--primary:active {
  background: var(--color-primary-dark);
  transform: translateY(0);
  box-shadow: var(--shadow-subtle);
}

.button--primary:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button--primary:disabled {
  background: var(--color-neutral-gray-300);
  color: var(--color-neutral-gray-600);
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
  transform: none;
}
```

### Example 2: Card Component

```html
<div class="card">
  <h2 class="card__title">Card Title</h2>
  <p class="card__content">Card content goes here.</p>
  <button class="button button--primary">Action</button>
</div>
```

```css
.card {
  background: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-medium);
}

.card__title {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-h3);
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-neutral-gray-900);
}

.card__content {
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-neutral-gray-700);
  margin: 0 0 var(--spacing-md) 0;
}
```

### Example 3: Form Input

```html
<div class="form-group">
  <label for="email" class="form-group__label">Email</label>
  <input
    type="email"
    id="email"
    class="form-group__input"
    placeholder="Enter your email"
    required
  >
</div>
```

```css
.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group__label {
  display: block;
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-neutral-gray-700);
  margin-bottom: var(--spacing-sm);
}

.form-group__input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  border: 1px solid var(--color-neutral-gray-300);
  border-radius: var(--radius-md);
  transition: var(--transition-fast);
}

.form-group__input:hover {
  border-color: var(--color-neutral-gray-400);
}

.form-group__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(255, 99, 99, 0.1);
}

.form-group__input:disabled {
  background: var(--color-neutral-gray-100);
  color: var(--color-neutral-gray-600);
  cursor: not-allowed;
}
```

---

## Getting Help

If you have questions about:
- **Token values** - Check `design-tokens.json`
- **CSS implementation** - Reference `design-system.css`
- **Design decisions** - Read the philosophy in `STYLE-GUIDE.md`
- **Token usage** - This guide has examples above

**Generated by makeui.dev Design Extractor**
