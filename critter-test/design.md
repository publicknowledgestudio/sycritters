---

version: alpha
name: Forge
description: Forge’s design system

colors:
  divider:
    token: "--fds-color-divider"
    value: "#f2efe3"

  action:
    background:
      enabled:
        token: "--fds-color-action-background-enabled"
        value: "#86923f"
      hover:
        token: "--fds-color-action-background-hover"
        value: "#758037"
      active:
        token: "--fds-color-action-background-active"
        value: "#86923f"
      disabled:
        token: "--fds-color-action-background-disabled"
        reference: "--fds-color-background-neutral-enabled"

    foreground:
      enabled:
        token: "--fds-color-action-foreground-enabled"
        reference: "--fds-color-background-subtle"
      disabled:
        token: "--fds-color-action-foreground-disabled"
        reference: "--fds-color-foreground-disabled"
      default:
        token: "--fds-color-action-foreground"
        alias_of: "--fds-color-action-foreground-enabled"

  background:
    base:
      token: "--fds-color-background-base"
      value: "#ffffff"

    subtle:
      token: "--fds-color-background-subtle"
      value: "#f7f6f2"

    contained:
      token: "--fds-color-background-contained"
      value: "#d4ceba"

    accent:
      sunset:
        token: "--fds-color-background-accent-sunset"
        value: "#fbe7e0"
      mulberry:
        token: "--fds-color-background-accent-mulberry"
        value: "#f4e6ec"
      sky:
        token: "--fds-color-background-accent-sky"
        value: "#e0f2ff"
      olive:
        token: "--fds-color-background-accent-olive"
        value: "#edefdc"
      clay:
        token: "--fds-color-background-accent-clay"
        value: "#f3f0ec"

    attentive:
      enabled:
        token: "--fds-color-background-attentive-enabled"
        value: "#ffca0a2b"
      hover:
        token: "--fds-color-background-attentive-hover"
        value: "#ffca0a4d"

    ghost:
      hover:
        token: "--fds-color-background-ghost-hover"
        value: "#b2a6761a"
      active:
        token: "--fds-color-background-ghost-active"
        value: "#aba58c26"
      selected:
        token: "--fds-color-background-ghost-selected"
        value: "#b2a6761a"

    informative:
      enabled:
        token: "--fds-color-background-informative-enabled"
        value: "#42afff26"
      hover:
        token: "--fds-color-background-informative-hover"
        value: "#42afff3d"

    negative:
      enabled:
        token: "--fds-color-background-negative-enabled"
        value: "#d0564321"
      hover:
        token: "--fds-color-background-negative-hover"
        value: "#d056433b"

    neutral:
      enabled:
        token: "--fds-color-background-neutral-enabled"
        value: "#b2a67626"
      hover:
        token: "--fds-color-background-neutral-hover"
        value: "#b2a67640"

    positive:
      enabled:
        token: "--fds-color-background-positive-enabled"
        value: "#b1d30729"
      hover:
        token: "--fds-color-background-positive-hover"
        value: "#b1d3074f"

  foreground:
    primary:
      token: "--fds-color-foreground-primary"
      value: "#262626"

    secondary:
      token: "--fds-color-foreground-secondary"
      value: "#8e8c8a"

    disabled:
      token: "--fds-color-foreground-disabled"
      value: "#b7b6b5"

    positive:
      token: "--fds-color-foreground-positive"
      value: "#64780c"

    negative:
      token: "--fds-color-foreground-negative"
      value: "#cb1714"

    attentive:
      token: "--fds-color-foreground-attentive"
      value: "#876d0d"

    informative:
      token: "--fds-color-foreground-informative"
      value: "#0071c2"

    accent:
      sunset:
        token: "--fds-color-foreground-accent-sunset"
        value: "#e36438"
      mulberry:
        token: "--fds-color-foreground-accent-mulberry"
        value: "#964062"
      sky:
        token: "--fds-color-foreground-accent-sky"
        value: "#24a3ff"
      olive:
        token: "--fds-color-foreground-accent-olive"
        value: "#95a447"
      clay:
        token: "--fds-color-foreground-accent-clay"
        value: "#977e5b"

  outline:
    enabled:
      token: "--fds-color-outline-enabled"
      value: "#b2a67645"
    hover:
      token: "--fds-color-outline-hover"
      value: "#b2a6768a"
    active:
      token: "--fds-color-outline-active"
      value: "#b2a676c4"
    disabled:
      token: "--fds-color-outline-disabled"
      value: "#ebebea"
    error:
      token: "--fds-color-outline-error"
      value: "#cb1714"
    focus:
      token: "--fds-color-outline-focus"
      value: "#95a447"
    selected:
      token: "--fds-color-outline-selected"
      value: "#b2a676c4"

spacing:
  xxsmall:
    token: "--fds-space-xxsmall"
    value: "2px"

  xsmall:
    token: "--fds-space-xsmall"
    value: "4px"

  small:
    token: "--fds-space-small"
    value: "8px"

  medium:
    token: "--fds-space-medium"
    value: "12px"

  large:
    token: "--fds-space-large"
    value: "16px"

  xlarge:
    token: "--fds-space-xlarge"
    value: "24px"

  xxlarge:
    token: "--fds-space-xxlarge"
    value: "32px"

radius:
  small:
    token: "--fds-radius-small"
    value: "0px"

effects:
  elevation:
    small:
      token: "--fds-elevation-small"
      value: "0px 4px 16px 0px #f8e2b633, 0px 1px 2px 0px #e8e1d399"

    medium:
      token: "--fds-elevation-medium"
      value: "0px 8px 24px 0px #3d54210d, 0px 3px 12px 0px #3d542114"

typography:
  header:
    medium:
      class: "header-medium"
      font_family: "Feature Display Trial"
      font_weight: 400
      font_size: "24px"
      line_height: "28px"
      letter_spacing: "0.3px"

  title:
    medium:
      class: "title-medium"
      font_family: "Geist"
      font_weight: 500
      font_size: "14px"
      line_height: "22px"
      letter_spacing: "0px"

    small:
      class: "title-small"
      font_family: "Geist"
      font_weight: 500
      font_size: "12px"
      line_height: "18px"
      letter_spacing: "0px"

  body:
    medium:
      class: "body-medium"
      font_family: "Geist"
      font_weight: 400
      font_size: "14px"
      line_height: "22px"
      letter_spacing: "0px"

    small:
      class: "body-small"
      font_family: "Geist"
      font_weight: 400
      font_size: "12px"
      line_height: "18px"
      letter_spacing: "0px"

  label:
    small:
      class: "label-small"
      font_family: "Geist Mono"
      font_weight: 500
      font_size: "12px"
      line_height: "12px"
      letter_spacing: "0px"

    xsmall:
      class: "label-xsmall"
      font_family: "Geist Mono"
      font_weight: 500
      font_size: "10px"
      line_height: "10px"
      letter_spacing: "0px"

---

# Forge

## Overview

Forge is a dense product-interface system with restrained surfaces, low-radius controls, and semantic color rather than decorative color. The core feel is editorial but operational: warm neutrals, olive action states, compact controls, mono labels, and small status primitives that scale into lists, menus, sidebars, timelines, callouts, and toasts.

This is the Light theme. Treat the light mode as the default and mirror every semantic role into dark mode rather than creating one-off dark colors.

## Colors

Forge uses a very intentional set of colors, all of which are utilised in various contexts to make their use efficient and keeping the set of tokens low. The color tokens follow a semantic naming system, where the name hints towards where this token can be used. Some tokens might be closer in their values, but are named differently just because of their usage - this is intentional

- `colors.divider`: Used as the default color for divider component and as an outline for non-interactive cards in the UI. The panels in the UI also use this as the border color.
- `colors.action.background` : Used as the background color for the contained (primary) button in different interactive states.
- `colors.background.base`: Used as the default white background across the UI.
- `colors.background.subtle`: Used as the default off-white background across the UI. Usually non-interactive containers nested inside each other alternate between the ‘base’ and ‘subtle’ colors as their background.
- `colors.background.contained`: Not used anywhere yet.
- `colors.background.accent.sunset`: Background color while representing the sunset accent.
- `colors.background.accent.mulberry`: Background color while representing the mulberry accent. Used when showing user-added attachments in the composer.
- `colors.background.accent.sky`: Background color while representing the sky accent. Used when showing chat-generated context in the composer.
- `colors.background.accent.olive`: Background color while representing the olive accent. Olive is the designated brand color to be used across the UI apart from the sentiment colors.
- `colors.background.accent.clay`: Background color while representing the clay accent.
- `colors.background.attentive`: Background colors while representing a attentive/warning sentiment in the enabled & hover state. Used in the callout & badge components.
- `colors.background.ghost.hover`: Background colors for a ghost container in the enabled hover & selected state. Used in the ghost button component.
- `colors.background.informative`: Background colors while representing a informative sentiment in the enabled & hover state. Used in the callout & badge components.
- `colors.background.negative.enabled`: Background colors while representing a negative sentiment in the enabled & hover state. Used in the callout & badge components.
- `colors.background.neutral.enabled`: Background colors while representing a neutral sentiment in the enabled & hover state. Used in the callout & badge components.
- `colors.background.positive.enabled`: Background colors while representing a positive sentiment in the enabled & hover state. Used in the callout & badge components.
- `colors.foreground.primary`: Foreground (text & icon) color for primary elements that need to be read clearly in the UI.
- `colors.foreground.secondary`: Foreground (text & icon) color for secondary elements that act as supporting information in the UI.
- `colors.foreground.disabled`: Foreground (text & icon) color for all disabled elements. Any information that can be interacted with or needs to be read clearly should not be using this color.
- `colors.foreground.positive`: Foreground color while representing a positive sentiment. Used in the callout & badge components.
- `colors.foreground.negative`: Foreground color while representing a negative sentiment. Used in the callout & badge components.
- `colors.foreground.attentive`: Foreground color while representing a attentive/warning sentiment. Used in the callout & badge components.
- `colors.foreground.informative`: Foreground color while representing a informative sentiment. Used in the callout & badge components.
- `colors.foreground.accent.sunset`: Foreground color while representing the sunset accent.
- `colors.foreground.accent.mulberry`: Foreground color while representing the mulberry accent. Used when showing user-added attachments in the composer. Used as the icon colors for deployable artifact types.
- `colors.foreground.accent.sky`: Foreground color while representing the sky accent. Used when showing the voice waveform in the composer. Used when showing chat-generated context in the composer.
- `colors.foreground.accent.olive`: Foreground color while representing the olive accent. Olive is the designated brand color to be used across the UI apart from the sentiment colors. Used inside the switch, radio and checkbox components.
- `colors.foreground.accent.clay`: Foreground color while representing the clay accent. Used as the icon colors for non-deployable artifact types.
- `colors.outline.enabled`: Border color for interactive cards/elements in the enabled, hover, active, disabled, error, focus and selected states. Used in the secondary (outlined) button component.
- `colors.outline.focus`: Universal border color to show the keyboard focus state.

## Typography

Header styles use Feature Display. Title & Body styles use Geist. Labels use Geist Mono.

- `typography.header.medium`: Used as decorative serif header style to bring a warm vibe to Forge. Currently used as focused headers and representing highlight numbers in charts. Exclusively use it with the `colors.foreground.primary` color in the enabled state.
- `typography.title.medium`: Used as the main title style to make them stand out of the rest. The font size is small, hence the font weight does the work. Exclusively use it with the `colors.foreground.primary` color in the enabled state.
- `typography.title.small`: Used as the secondary title style when the `title.medium` size is too big. Usually used inside nested elements when `title.medium` has already been used higher up in the hierarchy. It’s okay to use `title.small`  across different levels if the nesting goes deep. Exclusively use it with the `colors.foreground.primary` color in the enabled state.
- `typography.body.medium`: Used as the main body text style for easy readability across long walls of text.
- `typography.body.small`: Used as the secondary body text style usually inside nested elements where using the `body.medium` proves to be too big.
- `typography.label.small`: Used as the designated label style used inside the primary & secondary buttons, also as section headers in menus lists and sometimes to add a technical vibe to Forge through typography like showing versions like V1, V2, V3 or Dev & Prod. Use it with the `colors.foreground.secondary` color if it’s a section header else use the `colors.foreground.primary`  if the text is a primary element.
- `typography.label.xsmall`: Used as the secondary label style when `label.small` feels too big. Currently used as label headers inside nested elements and as column headers inside tables. Exclusively use it with the `colors.foreground.secondary` color.

## Spacing

- Spacing follows a 4px scale: 2, 4, 8, 12, 16, 24, 32px.
- `spacing.medium` is the default spacing token. Use the smaller sizes as the containers get more nested and use the bigger sizes as you move up in the nesting layers.
- Containers that lie in the same level of nesting or hierarchy should be using similar or the same spacing tokens so they feel coherent and related to each other.

## Shapes & Radii

- Forge follows a strict 0px border radius UI with the `radius.small` -  which gives the product a technical and editorial vibe in contrast to the common SaaS tools out there.

## Elevation & Depth

- `effects.elevation.small`: Background shadow to show elevation in trivial UI elements like tooltips.
- `effects.elevation.medium`: Background shadow to show elevation in bigger UI elements like menus & dialogs.

## Motion

Motion should communicate change, not draw attention to itself.

- Use motion only when it improves understanding of a state change, transition, or spatial relationship.
- Interactions without visible movement should feel immediate and use no transition (`0ms`).
- Small moving elements, such as switch handles, should use the `snap` easing (`cubic-bezier(0.4, 0.2, 0.5, 1)`) with a duration of `100ms`.
- Elements entering, exiting, expanding, or changing position should use the `smooth` easing (`cubic-bezier(0.44, 0, 0.4, 1)`), typically `100ms` for state changes and `300ms` for overlays, drawers, and modals.
- Avoid decorative, looping, or attention-seeking animations.
- Respect `prefers-reduced-motion` by removing non-essential motion and preserving functionality.

## Components

- Button component has 4 variants, each with 2 sizes and their states.
    - They use different text styles and default foreground colors which should be respected when using the components.
    - If you’re trying to represent an error state, you can use the outlined or the subtle button but with the negative foreground color.
- Card components are extremely versatile and can be morphed to fit different use cases which show information and actions both.
    - You can use dividers that go across the card (touching the sides) either horizontally or vertically to show separation inside the cards.
    - When used on the base background, you can also use the subtle background instead of a divider to show the container separation.
    - Keep the actions at the top right of the card or at the bottom left.
    - Be very pragmatic with how you use tags, if the text inside the tag is obvious, simply use the badge to represent the sentiment.

## Voice & Content

Content is part of the interface and should be clear, direct, and actionable.

- Use Title Case for labels, buttons, tabs, and headings.
- Use sentence case for body copy, helper text, descriptions, and notifications.
- Label actions with a clear verb and noun rather than generic confirmations if the space allows.
- Error messages should explain what happened and what the user can do next.
- Empty states should guide users toward the most relevant next action.
- Use present-participle verbs with an ellipsis for ongoing processes (`Saving…`, `Deploying…`).
- Remove unnecessary words and filler; every piece of copy should serve a purpose.

## Do's and Don'ts

- Use disabled colors only for disabled elements. Never use them for content that users need to read, understand, or interact with.
- Use only colors defined by the FDS design tokens. Avoid introducing custom or hardcoded values.
- Limit each screen or view to a single primary action. Secondary actions should remain visually subordinate.
- Keep icons and text within the same foreground hierarchy. Both should use the same semantic color level (`primary`, `secondary`, or `disabled`).
- Avoid presenting more than three actions for a single element. Prioritize the most common action and move less frequently used actions into an overflow menu.
- Horizontally grouped elements should be visually aligned (centered). When text can wrap onto multiple lines, preserve the position of adjacent elements and use spacing adjustments to maintain alignment across both single-line and multi-line states.
- Vertically stacked elements should align to the left edge to create a clear visual rhythm and scanning path.
- Prefer consistency over local optimization. When in doubt, follow established patterns rather than introducing new behavior for a single use case.