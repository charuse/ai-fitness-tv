# Amazon Devices Builder Tools (ADBT) Instructions
- Target Platforms: Fire OS and Vega OS.
- 10-foot UI Rules:
  * Every interactive element must use `hasTVPreferredFocus` or handle `onFocus`/`onBlur` states with visible contrast borders (2-4px white/yellow border).
  * Interactive targets must scale up slightly (e.g., `transform: [{ scale: 1.08 }]`) on D-pad highlight.
  * All views must account for TV overscan safe zones (minimum 24px-48px outer margins).