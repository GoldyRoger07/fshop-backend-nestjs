# fshop-backend — Spécification d'implémentation (API NestJS)

> **Backend de la plateforme e-commerce fshop.**
> Cette spec est **subordonnée à la spec produit canonique** (`../fshop-ssr/SPEC.md`).
> En cas de contradiction sur le **domaine/produit**, la spec canonique fait foi.
> Ce document détaille l'**implémentation backend** que la spec canonique laisse de
> haut niveau.
>
> ⚠️ **Écart assumé avec la spec canonique** : celle-ci indique « Backend : Spring
> Boot ». Décision du propriétaire : le backend est réalisé en **NestJS (Node.js /
> TypeScript)**. Il faut **mettre à jour la ligne correspondante dans
> `../fshop-ssr/SPEC.md`** (§2 et §4) pour lever l'incohérence.
>
> **Hypothèses par défaut retenues** (à confirmer) :
> - **Pas de Redis** → cache in-memory, verrous via `SELECT ... FOR UPDATE`.
> - **Jobs asynchrones** via **`@nestjs/schedule` (cron) + table outbox** (pas de BullMQ, qui exigerait Redis).
> - **ORM : TypeORM** (décision propriétaire, ex-Prisma). Migrations via TypeORM Migrate.
> - **Base : MySQL 8** (décision propriétaire, ex-PostgreSQL 16). ⚠️ Les fonctions
>   Postgres évoquées plus bas (FTS `tsvector`, `pg_trgm`, colonnes `GENERATED`)
>   n'existent pas en MySQL : la recherche s'appuiera sur `FULLTEXT INDEX` MySQL
>   (`MATCH ... AGAINST`) et/ou `LIKE`. À revoir lors de l'implémentation catalogue.
> - Une seule instance API en v1 (VPS). Archi extractible si scale-out plus tard.

---

## 1. Rôle & responsabilités du backend

Le backend est l'**API REST** qui détient **toute la logique métier** de fshop.
Le frontend Angular SSR n'a **aucune autorité** sur les prix, le stock, les totaux
ni les transitions d'état — il affiche des données et relaie l'authentification.

Le backend est **seul responsable** de :
- La vérité sur le catalogue, le stock, les prix et les totaux.
- La réservation de stock et la prévention de la survente.
- Le tunnel de commande et l'intégration paiement MonCash (vérification serveur autoritaire).
- La machine à états des commandes et ses effets de bord (notifications, stock).
- L'authentification/autorisation et la protection des endpoints admin.
- La modération (avis) et les flux manuels admin (statuts livraison, retours, remboursements).

**Contexte non-fonctionnel dimensionnant** : marché haïtien, mobile-first, **data
limitée** → réponses API compactes, pagination, pas de sur-fetch, images déléguées
au CDN. Mono-vendeur, mono-devise **HTG**, mono-langue **FR**, **sans taxe** en v1.

---

## 2. Stack & dépendances

| Élément | Choix | Notes |
|---|---|---|
| Runtime | **Node.js 20/22 LTS** ⚑ | I/O asynchrone natif |
| Langage | **TypeScript** (strict) | `strict: true`, pas d'`any` implicite |
| Framework | **NestJS 10+** | Modules, DI, guards, pipes, interceptors, filters |
| ORM | **TypeORM** ⚑ (décision proprio, ex-Prisma) | Entités décorées, migrations ; requêtes natives (`$queryRaw`→`query()`) pour verrous/décréments atomiques |
| Migrations | **TypeORM Migrate** | Versionnées, rejouables, appliquées au déploiement |
| Base | **MySQL 8** ⚑ (décision proprio, ex-PostgreSQL 16) | Source de vérité unique ; recherche via `FULLTEXT`/`LIKE` (pas de `tsvector`/`pg_trgm`) |
| Validation | **class-validator + class-transformer** | Via `ValidationPipe` global (whitelist + forbidNonWhitelisted) |
| Auth | **@nestjs/passport + passport-jwt + @nestjs/jwt** | Access token + refresh cookie HttpOnly |
| Hash mot de passe | **argon2** (npm) | ou bcrypt |
| Cache | **@nestjs/cache-manager** (in-memory LRU) ⚑ | Cache catalogue ; pas de Redis en v1 |
| Jobs/scheduling | **@nestjs/schedule** (cron) + table Postgres ⚑ | Libération réservations, relais outbox, réconciliation |
| Rate limiting | **@nestjs/throttler** (in-memory) | Endpoints sensibles |
| Doc API | **@nestjs/swagger** | OpenAPI + Swagger UI générés |
| Stockage média | **@aws-sdk/client-s3** | AWS S3 / Cloudflare R2 / MinIO ; uploads pré-signés |
| Logs | **nestjs-pino** (JSON) | Corrélation `requestId`, sans PII/secret |
| Observabilité | **@nestjs/terminus** (health) + **prom-client** | + OpenTelemetry sur le tunnel commande |
| Config | **@nestjs/config** (+ validation d'env avec zod/joi) | Profils dev/prod, secrets via env |
| Tests | **Jest + Supertest + Testcontainers** | DB Postgres réelle en intégration |
| Gestionnaire de paquets | **pnpm** ⚑ (ou npm) | + build Docker multi-stage |

> **Note money & TypeScript** : les montants sont des **entiers en centimes de HTG**.
> Ils tiennent largement dans `Number.MAX_SAFE_INTEGER` (2^53), donc `number` suffit
> en pratique ; on encapsule néanmoins dans un type `Money` (`common`) pour éviter
> les additions de flottants et centraliser l'arrondi. Colonnes Postgres en `BIGINT`.

---

## 3. Architecture applicative — monolithe modulaire

Un seul déployable NestJS, découpé en **modules Nest à frontières nettes**. Un module
n'accède jamais au repository d'un autre module : la communication passe par les
**services applicatifs** exportés (providers exposés via `exports`). Objectif :
pouvoir extraire un module en microservice plus tard.

```
src/
├── common/            // erreurs, filtres d'exception, Money, pagination, décorateurs
├── config/            // ConfigModule, validation d'env, CORS, Swagger, cache, storage
├── identity/          // User, refresh tokens, auth, JWT, guards de rôle
├── catalog/           // Category, Product, Variant, Option, Image, recherche
├── cart/              // Cart, CartItem (serveur, lié au compte)
├── inventory/         // stock, réservations, libération, décréments atomiques
├── checkout/          // orchestration du tunnel (transactionnel)
├── order/             // Order, OrderItem, machine à états, order_events
├── payment/           // PaymentProvider (interface) + MonCashProvider, callbacks
├── shipping/          // ShippingZone, tarifs, snapshots d'adresse
├── review/            // avis achat-vérifié + modération
├── engagement/        // wishlist, recently_viewed
├── notification/      // NotificationService + adaptateurs (email/whatsapp/inapp/push)
├── media/             // upload S3, génération variantes responsive
├── admin/             // endpoints back-office (ROLE_ADMIN), dashboard
└── platform/          // outbox, scheduler/jobs, idempotency store, PrismaService
```

**Découpage par module** : `*.controller.ts` (+ DTO) → `*.service.ts` (application,
transactions) → `domain` (entités/règles) → `*.repository.ts` / clients externes
(infrastructure). Les entités/records Prisma ne sortent **jamais** tels quels :
mapping **DTO systématique** via `class-transformer` (`@Exclude`/`@Expose`).

---

## 4. Modèle de données (rappel + précisions backend)

Le schéma détaillé est dans la spec canonique §5. Précisions d'implémentation :

### 4.1 Money
- **Tous les montants = `BIGINT` en centimes de HTG** (`*_cents`), jamais de flottant.
- Type applicatif : `number` (dans la plage sûre) encapsulé par un helper `Money` centralisant addition/arrondi.
- Devise implicite HTG en v1, mais **colonne présente en base** pour compatibilité future.
- Arrondi au dernier moment (total ligne → total commande), règle **half-up** documentée.

### 4.2 Contraintes & index (critiques)
- `product.slug`, `category.slug`, `variant.sku`, `user.email` : **UNIQUE**.
- `product_variant.stock_qty` : `CHECK (stock_qty >= 0)`.
- Colonne `tsvector` **générée** (`GENERATED ALWAYS`) sur `product(name, description)` + index **GIN**.
- Index **GIN `pg_trgm`** sur `name` pour tolérance aux fautes.
- Index sur : `product(category_id, active)`, `order(user_id, status)`, `stock_reservation(expires_at, status)`, `cart_item(cart_id)`.
- Clés étrangères avec `ON DELETE` explicites (ex. `RESTRICT` sur produits référencés par des commandes).

> Certaines fonctionnalités (colonne `GENERATED`, index GIN/`pg_trgm`, `CHECK`) ne
> sont pas toutes exprimables dans le schéma déclaratif Prisma : elles sont ajoutées
> via des **migrations SQL manuelles** (`prisma migrate` avec SQL custom).

### 4.3 Immutabilité des commandes
- `order_item` porte des **snapshots** (`name_snapshot`, `unit_price_cents_snapshot`) : une commande passée est **immuable** même si le catalogue change.
- `order.shipping_address_snapshot` en **JSONB figé**.

### 4.4 Audit
- **`order_event`** (append-only) : `id`, `order_id`, `from_status`, `to_status`, `actor` (system/admin/customer), `payload` JSONB, `created_at`. Trace immuable pour support/litiges.

### 4.5 Idempotence & outbox (tables backend)
- **`idempotency_key`** : `key` (PK), `user_id`, `request_hash`, `response_snapshot`, `created_at` — déduplique les mutations rejouées (checkout, callback paiement).
- **`outbox_event`** : `id`, `type`, `payload` JSONB, `status` (`PENDING|SENT|FAILED`), `attempts`, `next_attempt_at`, `created_at`. Écrit **dans la même transaction** que le changement métier ; un relais planifié le publie (notifications, indexation).
- **`processed_payment_event`** : `provider_event_id` (PK) — déduplique les confirmations MonCash.

---

## 5. Authentification & sécurité

### 5.1 Modèle de tokens
- **Access token JWT** court (~15 min), signé (HS256/RS256), renvoyé au client (mémoire front).
- **Refresh token opaque** stocké **hashé** en base (`refresh_token`), transmis en **cookie `HttpOnly`, `Secure`, `SameSite=Lax`** (Lax pour supporter la navigation SSR ; à valider selon les flux cross-site).
- **Rotation** du refresh à chaque usage + **détection de réutilisation** : un refresh déjà consommé → révocation de toute la famille (session compromise).
- `logout` = révocation du refresh courant ; `logout-all` = révocation par `user_id`.

### 5.2 SSR & cookies
Le serveur Angular SSR relaie les cookies vers l'API lors des appels serveur. Le
backend accepte donc l'auth par **cookie** (via `cookie-parser`) **et** par header
`Authorization: Bearer` (clients futurs mobiles). CORS configuré pour l'origine SSR
avec `credentials: true`.

### 5.3 NestJS Security
- **Guards** : `JwtAuthGuard` (passport-jwt) global avec décorateur `@Public()` pour les routes ouvertes ; `RolesGuard` + `@Roles('ADMIN')` pour `/api/v1/admin/**`.
- **Stratégie stateless** : pas de session serveur ; l'état d'auth vient du token.
- Rôles : `CUSTOMER`, `ADMIN`.
- Mots de passe hachés via **argon2** (ou bcrypt).

### 5.4 Durcissement
- **Rate limiting** (`@nestjs/throttler`) sur `login`, `register`, `refresh`, `checkout`, callback paiement.
- **`ValidationPipe` global** : `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` → rejet des champs inconnus, coercition typée.
- **Helmet** (`@fastify/helmet` ou middleware express) pour les headers de sécurité ; HSTS aussi au niveau Nginx.
- **CSRF** : cookies `SameSite` + header custom exigé sur mutations si nécessaire.
- Secrets (JWT, MonCash, DB, S3) via **variables d'environnement** validées au boot (zod/joi), jamais commités ; `.env.example` fourni.
- Logs **sans PII ni secrets** ; `raw_payload` paiement stocké mais accès restreint.

---

## 6. Catalogue & recherche

- **Vue produit uniforme** : l'API renvoie toujours la même forme, produit simple ou à variantes. Un produit simple = une « variante par défaut » implicite (prix/stock au niveau produit exposés comme une variante unique). Simplifie le frontend.
- **Recherche** : requête native (`$queryRaw` Prisma) combinant `tsvector @@ websearch_to_tsquery('french', …)` + `pg_trgm` pour la tolérance aux fautes, avec **facettes** (catégorie, plage de prix, valeurs d'options, disponibilité) et **tri** (pertinence, prix ↑/↓, nouveautés). Pagination **keyset** pour les listes longues.
- **Cache lecture** in-memory (cache-manager) sur fiches produit/catégories, **invalidé** à la publication/màj produit (éviction par clé). Complète le cache HTTP court côté SSR.
- `active`/`draft` : un produit non actif n'apparaît jamais dans le catalogue public mais reste accessible en admin.

---

## 7. Panier

- **Serveur, lié au compte** (`cart` 1:1 `user`). Pas de panier invité (checkout compte obligatoire).
- `cart_item` **ne fige pas le prix** : prix et disponibilité **recalculés à chaque lecture** depuis la base (« toujours le prix courant »).
- À l'affichage : article devenu inactif/en rupture → **marqué invalide**, exclu du total, signalé au client (pas de blocage silencieux).
- Quantité demandée > stock disponible → clamp + message.
- Ajout/màj/suppression via endpoints dédiés ; recalcul serveur systématique du récapitulatif (sous-total, livraison selon zone, total).

---

## 8. Stock & concurrence (point critique)

Objectif : **jamais de survente**, avec une seule base Postgres et sans Redis.

**Disponibilité affichée** = `stock_qty − Σ(réservations ACTIVE non expirées)`.

### 8.1 Réservation à l'entrée en checkout (transactionnel)
Dans une **transaction Prisma** (`prisma.$transaction`, isolation adéquate) :
1. Ordonner les lignes par `variant_id` (ordre déterministe → **anti-deadlock**).
2. Pour chaque ligne :
   - `SELECT ... FOR UPDATE` (via `$queryRaw`) sur la variante/produit.
   - Calcul du disponible = `stock_qty − réservations actives`.
   - Si `disponible >= qty` → créer `stock_reservation` (`ACTIVE`, `expires_at = now + 15min` ⚑).
   - Sinon → **abandon** (throw → rollback), erreur `OUT_OF_STOCK` avec le détail des lignes fautives.

Variante d'implémentation (décrément atomique conditionnel, `$executeRaw`) :
```sql
UPDATE product_variant
SET stock_qty = stock_qty - $1
WHERE id = $2 AND stock_qty >= $1;  -- 0 ligne affectée ⇒ rupture
```
Le **modèle réservation** (colonne séparée) est préféré car il permet d'exposer un
disponible sans toucher au stock physique et de gérer proprement l'expiration.

### 8.2 Consommation / libération
- Paiement **confirmé** → réservations `CONSUMED` + `stock_qty` décrémenté définitivement (même transaction que le passage `PAID`).
- Expiration / échec / annulation → réservations `RELEASED` (stock redevient disponible).
- **Cron `@Interval`/`@Cron`** (`@nestjs/schedule`, ~60 s) : passe en `RELEASED` les réservations `ACTIVE` dont `expires_at < now`, et annule les commandes `PENDING_PAYMENT` associées. **Idempotent** (ne libère qu'une fois).

### 8.3 Défense en profondeur
- Re-vérification de disponibilité **au moment de créer la commande**.
- Contrainte `CHECK (stock_qty >= 0)` comme filet ultime.
- **Paramètre configurable** : durée de réservation (défaut 15 min).

⚑ À confirmer : autorise-t-on la précommande/backorder ? (défaut : non)

---

## 9. Checkout — orchestration transactionnelle

Endpoint `POST /api/v1/checkout` **idempotent** (`Idempotency-Key` obligatoire) :

1. Auth requise (compte obligatoire).
2. Charger le panier, **recalculer prix & disponibilité** (source de vérité serveur).
3. Résoudre adresse + **zone de livraison** → `shipping_cents`.
4. **Réserver le stock** (§8.1).
5. Créer `order` en **`PENDING_PAYMENT`** avec `order_item` **snapshotés** (prix figés ici), `subtotal/shipping/total` calculés serveur.
6. Écrire l'événement `order_event(created)` + effets via **outbox** (même transaction).
7. **Initier le paiement MonCash** (§10) → renvoyer l'URL de redirection au client.
8. Le reste (confirmation) est piloté par la **vérification serveur** au retour + réconciliation.

Toute erreur avant l'étape 5 → rollback complet (aucune réservation orpheline).

---

## 10. Paiement — MonCash via `PaymentProvider`

### 10.1 Abstraction
```ts
interface PaymentProvider {
  createPayment(order: Order): Promise<PaymentInitResult>;   // URL de redirection + référence
  verifyPayment(reference: string): Promise<PaymentStatus>;  // vérification serveur AUTORITAIRE
  refund(payment: Payment, amountCents: number): Promise<RefundResult>; // si supporté
}
```
`MonCashProvider` = première implémentation (token `PAYMENT_PROVIDER` injecté par DI).
L'abstraction **isole le risque** lié à l'API MonCash (détails à confirmer en début
de dev) et permet d'ajouter d'autres moyens de paiement plus tard.

### 10.2 Flux (redirection + confirmation serveur)
1. Backend appelle MonCash → obtient **URL de redirection** + `reference` ; crée `payment` en `PENDING` avec `raw_payload`.
2. Client redirigé vers MonCash.
3. Au retour (callback/redirect), backend **vérifie le statut auprès de MonCash côté serveur** (`verifyPayment`). **La commande n'est jamais validée sur la seule foi du client.**
4. Succès → transaction : `payment.PAID`, réservations `CONSUMED`, `order.PAID`, `order_event`, outbox (notifications).
5. Échec/expiration → `payment.FAILED`, `order.CANCELLED`, stock libéré.

### 10.3 Fiabilité
- **Idempotence** : `processed_payment_event(provider_event_id)` + `Idempotency-Key` sur le callback → une confirmation traitée **une seule fois**, même en cas de rejeu/double redirection.
- **Machine à états défensive** : ignorer une transition invalide (ex. `PAID` reçu après `REFUNDED`).
- **Réconciliation** : cron qui interroge MonCash pour les `payment` restés `PENDING` au-delà d'un seuil (redirect perdu) et rattrape l'état.
- `raw_payload` conservé pour réconciliation/litiges.

### 10.4 Remboursements
- **Si l'API MonCash le permet** → `refund()` déclenché depuis l'admin, `refund` local relié à la transaction PSP.
- **Sinon** → remboursement **manuel hors-ligne** + marquage `REFUNDED` en back-office (flux prévu). Décision figée après clarification de l'API MonCash.

⚑ À confirmer avec l'API réelle : webhooks vs vérification à la redirection, sandbox, format des montants (HTG), support remboursement.

---

## 11. Commandes — machine à états

États et transitions **autorisées** (les autres rejetées, `409 Conflict`) :

```
PENDING_PAYMENT ─▶ PAID ─▶ PREPARING ─▶ OUT_FOR_DELIVERY ─▶ DELIVERED
       │                                                        │
       └─▶ CANCELLED (paiement échoué / réservation expirée)    └─▶ RETURN_REQUESTED ─▶ REFUNDED
```

- Transitions `PREPARING → OUT_FOR_DELIVERY → DELIVERED` : **manuelles admin**.
- Chaque transition : validée par un **service de transition centralisé** (table de transitions autorisées), écrit un `order_event`, déclenche les effets via **outbox** (notifications, réintégration stock à l'annulation).
- Après `PAID`, la commande est **immuable** (snapshots).

---

## 12. Jobs asynchrones & cohérence

- **Pattern Outbox** : tout effet de bord (email, WhatsApp, push, indexation) est écrit en `outbox_event` **dans la transaction métier** (`prisma.$transaction`). Un relais **cron** publie ensuite → garantie « au moins une fois » sans perte si le process tombe. Consommateurs **idempotents**.
- **Traitement asynchrone** : NestJS étant non-bloquant, les appels externes (MonCash, S3, notifications) sont `await` hors transaction ou déportés vers l'outbox — **jamais** d'appel réseau bloquant à l'intérieur d'une transaction DB.
- Crons v1 (`@nestjs/schedule`) : libération des réservations expirées, relais outbox, réconciliation paiements, génération des variantes d'images (§14), purge des tokens/idempotency-keys expirés.
- **Retries** avec backoff (`attempts`, `next_attempt_at`) + statut `FAILED` au-delà d'un seuil + alerte (log/metric).
- ⚑ Si scale-out multi-instances : passer les crons en **leader election** (verrou Postgres advisory) ou migrer vers **BullMQ + Redis**.

---

## 13. Notifications

- `NotificationService` + **adaptateurs par canal** (providers Nest injectés) : email (SMTP/SendGrid/Mailgun), WhatsApp (API WhatsApp Business, templates à valider par Meta), push web (VAPID/Web Push, lib `web-push`), in-app (table `notification`).
- Déclenchement **via outbox** sur événements de commande (mapping événements→canaux, spec canonique §11).
- **In-app = canal toujours disponible** (source fiable) ; canaux externes = best-effort (échec non bloquant, retry).

---

## 14. Médias / images

- Upload admin → **stockage objet S3-compatible** (MinIO/R2/S3) via `@aws-sdk/client-s3`. Préférence pour **uploads pré-signés** (le binaire ne transite pas par l'API) ou upload via API selon contrainte VPS ⚑.
- **Génération asynchrone** de variantes responsive (plusieurs largeurs) en **WebP/AVIF** (lib **sharp**, via job outbox/cron) → objectif **légèreté data**.
- Diffusion via **CDN** ; l'API ne renvoie que des URLs + métadonnées (`srcset` géré côté Angular).

---

## 15. Contrat API

- **REST/JSON versionné** : `/api/v1/...` (versioning URI NestJS).
- **Format d'erreur uniforme** (RFC 7807 `application/problem+json`) : `type`, `title`, `status`, `code`, `detail`, `errors[]` (validation). Géré par un **`ExceptionFilter` global**.
- **Pagination** : keyset (curseur) pour les listes catalogue/commandes ; `page/size` acceptable pour l'admin.
- **DTO distincts des modèles Prisma** ; sérialisation via `ClassSerializerInterceptor` ; montants exposés en **centimes + devise**.
- **OpenAPI** généré (`@nestjs/swagger`) + Swagger UI (protégé hors prod).
- `Idempotency-Key` accepté sur checkout et callback paiement ; `ETag`/`If-None-Match` sur lectures catalogue.

### Groupes d'endpoints (indicatif)
- **Auth** : `POST /auth/register|login|refresh|logout`.
- **Catalogue (public)** : `GET /products`, `/products/{slug}`, `/categories`, `/search`.
- **Panier** : `GET /cart`, `POST/PATCH/DELETE /cart/items`.
- **Checkout/commandes** : `POST /checkout`, `GET /orders`, `GET /orders/{id}`.
- **Paiement** : `POST /payments/moncash/init`, `GET/POST /payments/moncash/callback`.
- **Compte** : `addresses`, `wishlist`, `recently-viewed`, `reviews`.
- **Admin** (`ROLE_ADMIN`) : CRUD produits/variantes/options/catégories, upload images, commandes & transitions de statut, remboursements, retours, modération avis, zones de livraison, dashboard.

---

## 16. Observabilité, config & déploiement

- **Logs structurés JSON** (nestjs-pino) avec `requestId` de corrélation ; **jamais** de PII/secret.
- **Health** (`@nestjs/terminus`) : DB, S3, MonCash joignable ; **métriques** (prom-client) : latence, erreurs, jobs en file, ruptures, taux de conversion checkout ; **tracing** OpenTelemetry sur le tunnel de commande.
- **Config par profils** (`@nestjs/config`, `.env` + validation d'env au boot) ; secrets en variables d'environnement.
- **Migrations** appliquées au déploiement (`prisma migrate deploy`) — étape CI/CD, pas au runtime applicatif.
- **Docker** (image Node multi-stage) ; service `api` dans le Docker Compose global (`frontend-ssr`, `api`, `postgres`, `minio`, `nginx`). Nginx : TLS, `/api` → NestJS.
- **Sauvegardes** : dumps PostgreSQL réguliers + stockage objet.

---

## 17. Tests & qualité

- **Unitaires** (Jest) : prix/totaux, transitions d'état, règles de réservation.
- **Intégration** : **Testcontainers** (Postgres réel) + **Supertest** (HTTP e2e).
- **Test anti-survente** : N checkouts concurrents (`Promise.all`) sur la dernière unité → **exactement un** succès.
- **Tests paiement** : rejeu du callback, double redirection, statut invalide, réconciliation d'un `PENDING` orphelin.
- **Contrat API** : snapshots OpenAPI.
- **CI** : lint (eslint) + typecheck (tsc) + tests + build image Docker + `prisma migrate` vérifié.

---

## 18. Décisions ouvertes (backend)

1. **Écart avec la spec canonique** : mettre à jour `fshop-ssr/SPEC.md` (Spring Boot → NestJS).
2. **ORM** : Prisma (défaut) ou TypeORM ?
3. **Redis** : confirmer « Postgres seul » (défaut) ou l'ajouter si multi-instances prévu (débloquerait BullMQ pour les jobs).
4. **Jobs async** : `@nestjs/schedule` + outbox (défaut) — OK pour mono-instance ? Prévoir leader election si scale-out.
5. **Runtime HTTP** : Express (défaut Nest) ou **Fastify** (plus rapide, utile en contexte data limitée) ?
6. **MonCash** : webhooks ou vérification à la redirection ? sandbox ? support remboursement API ? format montants ?
7. **Upload images** : pré-signé (client→S3) ou via API (contrainte bande passante VPS) ?
8. **Précommande/backorder** autorisée ? Durée de réservation (défaut 15 min) ?
9. **SameSite** du refresh cookie : `Lax` (défaut, compat SSR) ou `Strict` ?
10. **Hash mot de passe** : argon2 (défaut) ou bcrypt ?

---

*Rédigé le 2026-07-02. Backend en **NestJS/TypeScript + PostgreSQL**, aligné sur le
domaine de `../fshop-ssr/SPEC.md` (spec canonique) sauf sur le choix du framework
backend, décidé par le propriétaire. Points §18 à trancher avant/pendant l'implémentation.*
