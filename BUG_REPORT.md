# Apartey — Bug & Failure Report

Scope: `Aparte/Backend` (.NET 9 Web API, EF Core + PostgreSQL, Paystack, Cloudinary, SignalR) and `Aparte/Frontend` (React 19 + Vite + Tailwind).

What was actually run:
- `dotnet build Shortlet.sln` → **succeeds**, 0 errors, 53 nullability warnings, 1 vulnerable package (MailKit 4.15.0, GHSA-9j88-vvj5-vhgr).
- Started the built API → **fails to start** on this machine (no .NET 9 runtime), then **crashes on missing JWT key**. With dummy config + roll-forward it boots, but **`/swagger` returns 500** (see B3).
- Frontend `npm ci` + `npm run build` → **succeeds** (single 838 kB JS chunk, so a code-splitting warning; Browserslist data is old). A JSX lint pass with the React hooks rules found 1 error (F4).
- Everything else below is from reading the code.

Severity: 🔴 blocks the app / loses money / security hole · 🟠 feature broken · 🟡 correctness/quality.

---

## 1. Startup & configuration blockers

| # | Sev | Problem | Where | Fix |
|---|---|---|---|---|
| A1 | 🔴 | **No .NET 9 runtime installed.** Projects target `net9.0`; machine has .NET 8 and 10 only. `dotnet run` exits with "You must install or update .NET". | `*.csproj` | Install the ASP.NET Core 9 runtime/SDK (`winget install Microsoft.DotNet.SDK.9`), **or** retarget all 3 projects to `net10.0` and bump EF/Npgsql/JwtBearer packages to 10.x (also update the Dockerfile images). |
| A2 | 🔴 | **No `appsettings.json` exists** (it's git-ignored). Startup throws `JWT Key is missing`; EF design-time factory requires the file (`optional: false`) so `dotnet ef` also fails. | `Program.cs:80`, `DesignTimeDbContextFactory.cs` | Create `Shortlet.Api/appsettings.Development.json` (template below) or use `dotnet user-secrets`. Commit an `appsettings.example.json` with blank values so the next dev knows the keys. |
| A3 | 🔴 | **Config key names are inconsistent**, so some features fail even with config present: Cloudinary is read as `CloudinarySettings:*` (Properties), `Cloudinary:*` (PropertyService) or either (Verification). Paystack is `Paystack:SecretKey` in Wallet/PaystackService but `PaystackSettings:SecretKey ?? Paystack:SecretKey` elsewhere. | several controllers | Pick one set (`Paystack:SecretKey`, `Cloudinary:CloudName/ApiKey/ApiSecret`) and use it everywhere; better, bind once to options classes in `Program.cs`. |
| A4 | 🔴 | **Port clash:** backend `launchSettings.json` uses `http://localhost:5173` — the same port Vite uses. Whichever starts second fails or Vite silently moves to 5174. | `Properties/launchSettings.json` | Change backend to e.g. `http://localhost:5080` / `https://localhost:7267`. |
| A5 | 🔴 | **Frontend is hard-wired to production API** (`https://aparte-s1sb.onrender.com/api`), so local dev never hits your local backend. | `Frontend/src/utils/api.js:5` | `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5080/api'` and add `.env.development` / Vercel env var. |
| A6 | 🟠 | Payment callback URLs are hard-coded (`https://aparteyng.vercel.app/...` in BookingsController, `http://localhost:5174/payment-success` in PaystackService). | `BookingsController.cs:175,252`, `PaystackService.cs` | Read a `Frontend:BaseUrl` config value. |
| A7 | 🟡 | `UseHttpsRedirection()` logs "Failed to determine the https port" on Render (HTTP only behind proxy). | `Program.cs` | Only use it in Development, or add `UseForwardedHeaders`. |
| A8 | 🟡 | Package version mix: `Microsoft.Extensions.Configuration.*` 10.0.3 and `System.IdentityModel.Tokens.Jwt` 8.16 alongside JwtBearer 9.0.0. Mismatched `Microsoft.IdentityModel.*` versions are a known cause of `IDX10500`/signature-validation failures. | csproj files | Align: everything 9.0.x (or all 10.x if you retarget), and remove the redundant `Configuration.Json` refs. Update MailKit to the patched version. |

Template for `Backend/Shortlet.Api/appsettings.Development.json` (fill in real values, never commit):

```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Port=5432;Database=apartey;Username=postgres;Password=..." },
  "Jwt": { "Key": "<at least 32 random chars>", "Issuer": "apartey-api", "Audience": "apartey-web" },
  "Paystack": { "SecretKey": "sk_test_..." },
  "Cloudinary": { "CloudName": "...", "ApiKey": "...", "ApiSecret": "..." },
  "Email": { "SmtpServer": "smtp.gmail.com", "SmtpPort": "587", "SenderEmail": "...", "SenderPassword": "..." },
  "Frontend": { "BaseUrl": "http://localhost:5173" },
  "Logging": { "LogLevel": { "Default": "Information" } }
}
```

Then: `cd Backend && dotnet tool install -g dotnet-ef && dotnet ef database update -p Shortlet.Infrastructure -s Shortlet.Api`.

---

## 2. Security holes (fix before anything else goes live)

| # | Sev | Problem | Where | Fix |
|---|---|---|---|---|
| S1 | 🔴 | **Cloudinary API secret hard-coded in source** as a fallback. Anyone with the repo can upload/delete your media. | `PropertiesController.cs:63-68` | **Rotate the Cloudinary secret now**, delete the fallback block, fail fast if config is missing. |
| S2 | 🔴 | **Anyone can register as admin.** `Role` comes straight from the request body: `POST /api/Auth/register {"role":"admin",...}`. | `AuthService.RegisterAsync` | Whitelist: `Role = request.Role?.ToLower() == "host" ? "host" : "guest"`. Create admins only via DB/seed. |
| S3 | 🔴 | **Any logged-in user can accept/reject any booking**, and reject triggers a real Paystack refund and debits the host's wallet. No ownership check. | `HostBookingsController` Accept/Reject | Load booking, `if (booking.Property.HostId != currentUserId) return Forbid();`. Also only allow accept/reject when `Status == "paid"`. |
| S4 | 🔴 | **SignalR hub is unauthenticated and lets a client join any user's room** (`JoinPrivateRoom(userId)`) → read anyone's messages/notifications. | `Hubs/ChatHub.cs` | Add `[Authorize]`; in `OnConnectedAsync` add the connection to `Context.UserIdentifier`'s group; remove `JoinPrivateRoom`. Configure `JwtBearerEvents.OnMessageReceived` to read `access_token` from the query string for `/chathub`. |
| S5 | 🟠 | Any user can create listings (no host role check), and listings go live immediately (search/list endpoints don't filter `Status`). | `PropertiesController` | `[Authorize(Roles = "host")]` (after normalising role casing — see C1), filter `Status == "active"` in public queries. |
| S6 | 🟠 | `GET /api/Messages/contacts` returns every user in the system. `GetSplitDetails` returns any split group to any logged-in user. | `MessagesController`, `BookingsController` | Contacts = users you share a booking/conversation with. |
| S7 | 🟠 | KYC ID documents uploaded as public Cloudinary raw files. | `VerificationController` | Use `Type = "authenticated"`/private delivery and signed URLs for admins. |
| S8 | 🟡 | Withdraw has a double-spend race (two concurrent requests both pass the balance check). | `WalletController.WithdrawFunds` | Deduct inside a transaction with a row lock / concurrency token, then call Paystack; refund the ledger on failure. |
| S9 | 🟡 | Login email lookup is case-sensitive and not normalised; webhook HMAC compare isn't constant-time; `new Random()` for check-in codes. | `AuthService`, `WebhooksController` | Lower-case emails on register/login; `CryptographicOperations.FixedTimeEquals`; `RandomNumberGenerator.GetInt32`. |

---

## 3. Backend functional bugs

| # | Sev | Problem | Where | Fix |
|---|---|---|---|---|
| B1 | 🔴 | **Every solo booking payment fails**: the URL is `https://api.api.paystack.co/transaction/initialize` (double `api.`) → DNS error → 500 "An internal error occurred". | `BookingsController.cs:179` | `https://api.paystack.co/transaction/initialize`. |
| B2 | 🔴 | **Split payments are never credited.** Shares get `PaymentReference = "SPLIT_{new random Guid}"`, but the webhook strips `SPLIT_` and looks the share up **by `Id`** — the random Guid never matches, so `PaidShares` never increments and the booking stays `split_pending` forever. | `BookingsController.cs:151`, `WebhooksController.cs:63-72` | In the webhook: `FirstOrDefaultAsync(s => s.PaymentReference == reference)`. (Or set reference to `$"SPLIT_{share.Id}"`.) |
| B3 | 🔴 | **Swagger UI crashes (HTTP 500)** — Swashbuckle rejects `[FromForm] IFormFile` as a bare action parameter. Verified at runtime. | `VerificationController.UploadDocument` | Wrap in a class: `public class KycUploadDto { public IFormFile Document {get;set;} public string DocumentType {get;set;} }` → `UploadDocument([FromForm] KycUploadDto dto)` + `[Consumes("multipart/form-data")]`. |
| B4 | 🔴 | **Admin endpoints return 500 for non-admins**: `Forbid("Access Denied...")` treats the string as an *authentication scheme name* and throws `InvalidOperationException`. | `AdminController.cs` (3 places) | `return StatusCode(403, new { message = "Access denied" });` or just `[Authorize(Roles = "admin")]` on the controller. |
| B5 | 🟠 | **Abandoned bookings block dates forever.** Overlap check and `booked-dates` count `pending` / `split_pending` with no expiry; unpaid checkouts and expired split groups are never released. | `BookingsController.cs:68-72`, `PropertiesController.GetBookedDates` | Only block `pending` rows younger than ~30 min and `split_pending` before `ExpiresAt`; add a background job to mark them `expired`. |
| B6 | 🟠 | Reject-booking refund math is wrong: debits `TotalPrice / 1.05`, but the webhook credited `(TotalPrice − caution − addOns)/1.05 + addOns`. Host balance drifts (can go negative). Paystack refund result is ignored. | `HostBookingsController.RejectBooking` | Debit the exact amount from the original Credit transaction (look it up by `Reference == booking.Id`); check the refund response before changing status. |
| B7 | 🟠 | Accepting a booking overwrites the check-in code that was already created and allows accepting unpaid (`pending`) bookings. | `HostBookingsController.AcceptBooking` | Require `Status == "paid"`; keep the existing code. |
| B8 | 🟠 | **Emails are never actually sent from the queue** — `EmailBackgroundWorker` just waits 2 s and logs "SUCCESS". | `EmailBackgroundWorker.cs` | Create a scope and call `IEmailService.SendEmailAsync(payload.ToEmail, payload.Subject, payload.Body)`. |
| B9 | 🟠 | Split share can't be retried: Paystack rejects a re-used `reference`, and the share always reuses its stored one. | `BookingsController.PaySplitShare` | Generate a fresh reference per attempt (store attempts or encode share id: `SPLIT_{shareId}_{n}`) and match on prefix in the webhook. |
| B10 | 🟠 | Booking creation doesn't validate check-in in the past, property `Status`, or `SplitWays` upper bound; no DB transaction around booking + split rows. | `BookingsController.CreateBooking` | Add those checks; wrap in `BeginTransactionAsync`. |
| B11 | 🟠 | Withdraw sends `amount = request.Amount * 100` as a decimal (e.g. `150050.00`); Paystack expects an integer in kobo. | `WalletController.cs:123` | `(long)Math.Round(request.Amount * 100)`. |
| B12 | 🟡 | Dead/duplicate code: `IBookingService/BookingService`, `IPropertyService/PropertyService`, `PropertyRepository`, `Property.Images`/`PropertyImage`, `AvailabilityDate`, `Conversation` are unused — the controllers do it all inline with different rules. `GuestBookingsController` duplicates `/Bookings/guest` and returns an empty image. | — | Delete or consolidate; one booking path. |
| B13 | 🟡 | Analytics returns fake numbers: occupancy gets `+12` when empty, `listingViews = properties × 342`, guest name always "Guest User". | `HostAnalyticsController` | Return real data or label as placeholder in the UI. |
| B14 | 🟡 | Reviews: rating not validated (1–5), only `confirmed` bookings count (guests whose booking is `paid` but not yet accepted can't review — maybe intended), comment nullable. | `ReviewsController` | Validate input with data annotations. |
| B15 | 🟡 | `GetProperties`/search order by `Id` (random Guid) → random order each page; search lower-cases columns (no index use). | `PropertiesController` | Order by `CreatedAt`; use `EF.Functions.ILike`. |
| B16 | 🟡 | `CautionFee` parsed with `decimal.Parse(Request.Form[...])` — culture-dependent and throws on bad input; bind it on the DTO instead. 53 nullable warnings (CS8618/CS8602) mark real null-risk spots. | `PropertiesController.cs:135` | Add `public decimal CautionFee {get;set;}` to `CreatePropertyFormData`. |

---

## 4. Frontend bugs

| # | Sev | Problem | Where | Fix |
|---|---|---|---|---|
| F1 | 🔴 | **Refreshing a protected page logs you out to /login.** `AuthContext` loads the token in a `useEffect`, so on first render `isAuthenticated` is false; `MyTrips`' own effect runs first and redirects. | `context/AuthContext.jsx` | Initialise state synchronously: `useState(() => localStorage.getItem('shortlet_token'))` and same for user. |
| F2 | 🔴 | **KYC upload is fake** — the form shows "submitted successfully" via `setTimeout` and never calls `/Verification/upload`. Admin queue is always empty. | `pages/Dashboard.jsx:~258-267` | `await api.post('/Verification/upload', kycFormData)` then update state from the response. |
| F3 | 🔴 | **Friends can't pay their split share.** The WhatsApp link opens `/split-success/:id`, which calls `GET /Bookings/split/{id}` — an `[Authorize]` endpoint. Logged-out friends get 401 → redirected home, and the 5-second poll repeats the error toast. | `SplitDashboard.jsx`, `BookingsController.GetSplitDetails` | Make `GetSplitDetails` `[AllowAnonymous]` (returning only non-sensitive fields), and stop the interval on error. |
| F4 | 🟠 | **Rules-of-Hooks violation**: `AdminDashboard` returns `<Navigate>` before calling `useEffect`. React will throw "Rendered more hooks than during the previous render" when auth state changes. | `pages/AdminDashboard.jsx:14-20` | Move the guard below all hooks. |
| F5 | 🟠 | **Dates shift by one day** for users east of UTC (Nigeria is UTC+1): `checkIn.toISOString()` turns local midnight 10 Dec into `2026-12-09T23:00Z`; backend then blocks 9 Dec. | `PropertyDetails.jsx:103-104` | Send date-only strings: `format(checkIn, 'yyyy-MM-dd')` (date-fns is already installed) and treat them as dates server-side. |
| F6 | 🟠 | "Withdraw Funds" button has no `onClick`; the modal state exists but no modal/handler is wired to `/Wallet/withdraw`. | `Dashboard.jsx:712` | Implement the modal + `api.post('/Wallet/withdraw', withdrawData)`. |
| F7 | 🟠 | Real-time chat/notifications don't exist on the client — `@microsoft/signalr` is installed but never imported, so `ReceiveNotification`/`ReceiveMessage` go nowhere. | — | Add a SignalR connection (with `accessTokenFactory`) after login, once S4 is fixed. |
| F8 | 🟠 | Role checks are case-sensitive and inconsistent: frontend sends `"Guest"/"Host"`, checks `'Host'` and `'admin'`; backend defaults `"guest"`. | `Register.jsx`, `Navbar.jsx`, `Dashboard.jsx` | Normalise to lower-case on the server (S2) and compare lower-case on the client. |
| F9 | 🟡 | Map geocodes every listing through Nominatim in parallel on every page change (violates their 1 req/s policy → throttled/blocked); random fallback coordinates; `via.placeholder.com` image is dead; popup uses `property.imageUrl` (field is `imageUrls`). | `components/PropertyMap.jsx` | Store lat/lng at listing time (the columns already exist), use `imageUrls[0]`. |
| F10 | 🟡 | ESLint config only targets `**/*.{ts,tsx}` and there is no `lint` script, so none of the `.jsx` code is linted (that's how F4 slipped through). | `eslint.config.js`, `package.json` | `files: ['**/*.{js,jsx}']`, drop `typescript-eslint`, add `"lint": "eslint ."`. |
| F11 | 🟡 | `Home` `useEffect` depends on `fetchProperties` but lists only `[page]`; `<title>` is "frontend"; `toast.error(error.response?.data)` can receive an object and crash rendering. | various | Minor clean-ups. |

---

## 5. Recommended order of work

1. **Get it running locally:** A1 → A2 → A4 → A5 → A3, then `dotnet ef database update`.
2. **Stop the bleeding:** rotate Cloudinary secret + S1, S2, S3, S4.
3. **Make payments work:** B1, B2, B9, B5, B6, B7, F5.
4. **Make features real:** F1, F2, F3, F4, B3, B4, B8, F6, F7.
5. Clean-up: everything 🟡, enable linting, add a few integration tests around booking + webhook.

---

## 6. Fix status (applied 2026-11-24)

A copy of the code before any changes is in `../Aparte_backup_before_fixes/`.

**Fixed:** A2–A8, S1–S6, S8, S9, B1–B16, F1–F11. Also fixed: the map popup "Book" button crashed (it called a function `Home` never passed in), the host "Decline booking" button was missing from the UI, partly-paid split groups weren't refunded when a host declined, and Paystack refused `SPLIT_` references because underscores aren't allowed (references are now `SPLIT-…`).

Checks run after the fixes:
- `dotnet build` succeeds. MailKit is now 4.16.0, and `dotnet list package --vulnerable` reports nothing.
- `npm run build` succeeds, and `npm run lint` now really lints the JSX: 0 errors, 5 minor warnings.
- Started the API with dev settings: `/swagger` returns 200 (it was 500 before). Admin endpoints and the SignalR hub return 401 without a token. The webhook rejects bad or missing signatures. CORS allows `localhost:5173`. Registration validates input before it touches the database.
- **Not tested end to end:** anything that needs a database, or Paystack and Cloudinary test keys (booking, webhook, refund, withdraw, upload). No PostgreSQL was available here.

**What you still need to do:**
1. **Rotate the Cloudinary API secret.** The old one is in the code's history and in the backup folder. Put the new one in config: locally `Cloudinary:*`; on Render `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret` (the old `CloudinarySettings__*` names still work).
2. Install the .NET 9 SDK (`winget install Microsoft.DotNet.SDK.9`), or run with `$env:DOTNET_ROLL_FORWARD="Major"` on .NET 10.
3. Fill in `Backend/Shortlet.Api/appsettings.Development.json`. It's git-ignored and already has a random JWT key; add your DB connection string, a Paystack **test** key, Cloudinary and SMTP. Then run `dotnet ef database update -p Shortlet.Infrastructure -s Shortlet.Api`. No schema changes were made, so no new migration is needed.
4. On Render, set `Frontend__BaseUrl=https://aparteyng.vercel.app` and the Paystack and Cloudinary variables.

**Still open (not done):**
- S7: KYC documents are still public Cloudinary URLs.
- There is no chat UI. Notifications now arrive as toasts over SignalR.
- Listings don't store coordinates, so the map still geocodes by address (now rate-limited and cached).
- Hosts have no admin approval step for listings.
- If a guest pays an abandoned checkout after its 30-minute hold and someone else took the dates in the meantime, both bookings show as paid. The host can decline one (that refunds it).
- No automated tests.
