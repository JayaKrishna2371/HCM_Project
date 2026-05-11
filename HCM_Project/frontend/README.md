# HCM Frontend (Angular 17 — standalone)

## Run locally

```powershell
cd "c:\Users\Jaya Krishna\OneDrive\Desktop\HCM_Project\frontend"
npm install
# Edit src/environments/environment.development.ts and fill in tenantId + clientId
npm start
```

App opens at <http://localhost:4200>.

## Drop in your images

```
src/assets/images/background.jpg   # the blue cloud-in-hand image you provided
src/assets/images/logo.png         # (optional) company logo
```

## Folder structure

```
src/
├── app/
│   ├── core/         # singletons — guards, interceptors, services, MSAL config, models
│   ├── features/     # routed feature components (login, dashboard, unauthorized)
│   ├── shared/       # reusable presentational components (spinner, toast)
│   ├── app.component.ts
│   ├── app.config.ts # standalone providers (router, HTTP, MSAL)
│   └── app.routes.ts
├── environments/
└── styles.scss       # global tokens + base styles
```
