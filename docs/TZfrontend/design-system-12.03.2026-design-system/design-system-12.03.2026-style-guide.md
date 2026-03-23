# You are implementing the Design System 12.03.2026

Your task is to create UI components and code that strictly adheres to this design system.

---

## Design Philosophy

This design system is built for a tablet-based executive documentation generation system. It prioritizes functional minimalism, information density, and productivity. The design removes visual noise while maintaining clear hierarchy and intuitive navigation. Every element serves a purpose, and the interface focuses on content over decoration.

---

## Design Principles & User Experience Goals

**Apply these principles to every decision**:
- Functional Minimalism - Only essential elements in the workspace, no decorative features
- Information Density - Maximum data visibility while preserving readability through proper spacing and typography
- Visual Hierarchy - Clear separation between navigation zones, content lists, and detail views
- Consistency - Uniform components and interaction patterns throughout the application
- Clarity First - Clean, uncluttered interface with subtle visual effects that support usability
- Touch-Optimized - All interactive elements sized appropriately for tablet interaction (minimum 40px touch targets)
- Data-Focused - Design supports quick scanning, data comparison, and document management workflows

**Achieve these user experience goals**:
- Enable rapid document generation and review workflows
- Support quick scanning of lists and tables with clear visual hierarchy
- Provide intuitive navigation without training
- Minimize cognitive load through consistent patterns
- Ensure all content is accessible within 2-3 taps maximum
- Support both portrait and landscape tablet orientations
- Maintain professional appearance suitable for executive stakeholders

---

## Design Tokens

All design values are defined as tokens in the accompanying files. Token categories include:

- **Colors**: Brand, semantic, and neutral color values
- **Typography**: Font families, sizes, weights, line heights, letter spacing
- **Spacing**: Consistent spacing scales based on an 8px base grid
- **Shadows**: Elevation and emphasis effects
- **Borders**: Border radius and width values
- **Animations**: Timing functions and transitions

**Token Naming Pattern**:
```
--[category]-[type]-[modifier]
```

Examples:
- `--color-primary` → Primary brand color
- `--spacing-md` → Medium spacing unit (16px)
- `--font-size-h1` → Heading 1 font size
- `--transition-fast` → Fast animation transition

---

## Reference Token Specifications

All token values and complete specifications are in these files:

### `design-tokens.json`
Complete, hierarchical token definitions in JSON format:
- Organized by category (colors, typography, spacing, etc.)
- Includes all metadata and usage information
- Machine-readable format for tooling

### `design-system.css`
Production-ready CSS custom properties:
- All tokens defined as CSS variables
- Organized with clear comments
- Includes utility classes and base component styles
- Ready to include directly in your project

**Always reference the actual token values from these files when generating code.**

---

## Implementation Constraints

Follow these constraints strictly when generating code:

### CSS Variables - Mandatory
- Use CSS variables for **every** design value (never hardcode hex codes, pixel values, etc.)
- Reference tokens from the `design-system.css` file
- Pattern: `var(--category-type-modifier)`

Example (Correct):
```css
.button {
  background: var(--color-primary);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
}
```

### Interactive States - Required
Every interactive element must support all five states:
1. **Default** - Initial, uninteracted state
2. **Hover** - Mouse over (desktop)
3. **Active** - Currently pressed or selected
4. **Focus** - Keyboard navigation focus (visible focus ring required)
5. **Disabled** - Not available/interactive

### Accessibility - Non-Negotiable
- Minimum WCAG AA compliance required
- Color contrast: 4.5:1 for regular text, 3:1 for large text
- Semantic HTML elements (button, input, nav, etc.)
- Keyboard navigation support for all interactive elements
- ARIA labels where semantic HTML is insufficient
- Visible focus indicators

### Semantic HTML - Required
- Use appropriate HTML elements (`<button>`, `<input>`, `<nav>`, `<article>`, etc.)
- Never use `<div>` for buttons or links - use proper semantic elements
- Use `<label>` for form inputs
- Use `<h1>` through `<h6>` for headings in proper hierarchy

### Token Stacking - Allowed
- Combine tokens for larger values (e.g., `padding: calc(var(--spacing-md) * 2)`)
- Never create new spacing/color values outside the design system
- Always base decisions on existing tokens

---

## Code Generation Requirements

When generating components, follow these requirements:

### 1. Start with Semantic HTML
Build the structure with proper semantic elements before adding styles.

### 2. Apply Design Philosophy
Every visual decision must align with the design philosophy and principles stated above.

### 3. Reference Token Values
Look up exact token values in the accompanying specification files:
- `design-tokens.json` for machine-readable specs
- `design-system.css` for CSS variable names

### 4. Implement All States
Generate code for default, hover, active, focus, and disabled states.

### 5. Test Accessibility
Verify:
- Keyboard navigation works
- Focus is visible
- Color contrast meets WCAG AA
- Screen readers can navigate

### 6. Use System Transitions
Apply transitions from the design system's timing functions:
- `var(--transition-fast)` for quick feedback
- `var(--transition-standard)` for normal animations
- `var(--transition-emphasis)` for emphasis effects

### 7. Maintain Consistency
- Use the same token throughout (don't recreate values)
- Follow established patterns from other components
- Ensure visual and interaction consistency

---

**This design system is your specification. Every line of code you generate must align with the philosophy, use the tokens, and follow the constraints above.**