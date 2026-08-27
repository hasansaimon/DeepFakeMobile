/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: "#17212B",
    tint: "#0D9488",

    // Core surfaces
    background: "#F7FAF9",
    foreground: "#17212B",

    // Cards / elevated surfaces
    card: "#FFFFFF",
    cardForeground: "#17212B",

    // Primary action color (buttons, links, active states)
    primary: "#0D9488",
    primaryForeground: "#FFFFFF",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#E5F4F1",
    secondaryForeground: "#17615B",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#EDF2F1",
    mutedForeground: "#6B7C7A",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#F6B84B",
    accentForeground: "#5C3D08",

    // Destructive actions (delete, error states)
    destructive: "#D95D5D",
    destructiveForeground: "#FFFFFF",

    // Borders and input outlines
    border: "#D7E3E0",
    input: "#C5D7D3",
  },

  dark: {
    text: "#F2F8F6",
    tint: "#42C9B8",
    background: "#10201F",
    foreground: "#F2F8F6",
    card: "#17302E",
    cardForeground: "#F2F8F6",
    primary: "#42C9B8",
    primaryForeground: "#10201F",
    secondary: "#21423F",
    secondaryForeground: "#C6EEE7",
    muted: "#1B3533",
    mutedForeground: "#9CB8B3",
    accent: "#F6B84B",
    accentForeground: "#3C2908",
    destructive: "#EF8B8B",
    destructiveForeground: "#281313",
    border: "#2A4B47",
    input: "#3B5E59",
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
