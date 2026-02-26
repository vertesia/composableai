# Application Components

Put your comonents and business logic here

Migration from previous version:
1. Move 
    - ui/app.tsx to app/index.tsx
    - ui/routes.tsx to app/routes.tsx
2. Removed src/index.css forwarder and adjusted 
`vertesiaPluginBuilder({ inlineCss: CONFIG__inlineCss, input: 'src/ui/index.css' }),`
in `vite.config.js`
3. Modified src/ui/main.tsx

Nothing to do for migration if you didn't added code in `src/index.css`


