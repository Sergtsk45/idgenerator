# AOSR Document Automation System

## Overview

This is a construction documentation automation system designed to streamline the creation of АОСР (Акты освидетельствования скрытых работ / Acts of Inspection for Hidden Works) documents. The system allows field engineers to log work activities via text/voice messages, which are processed by AI to extract structured data, then aggregated into formal inspection acts for hidden construction works.

The application is built as a mobile-first web app intended for use as a Telegram MiniApp, with bilingual support (Russian/English).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, Zustand for client state (language preferences)
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite with React plugin

The frontend follows a mobile-first design pattern with bottom navigation, optimized for Telegram MiniApp integration. Pages are organized under `client/src/pages/` with shared components in `client/src/components/`.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **AI Integration**: OpenAI API (via Replit AI Integrations) for message processing/normalization

The backend serves both the API and static files. In development, Vite middleware handles hot module replacement. In production, pre-built static files are served from `dist/public`.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Key Tables**:
  - `works`: Bill of Quantities (BoQ) items with codes, descriptions, units, and synonyms for AI matching
  - `messages`: Raw user input and AI-normalized structured data
  - `acts`: Generated AOSR documents with aggregated work data
  - `attachments`: Supporting documents linked to acts
  - `conversations`/`messages` (chat): For AI chat functionality

### AI Processing Pipeline
1. User submits work log message (text input)
2. Message stored with raw content
3. OpenAI processes message to extract: work code, description, quantity, unit, date, location
4. Normalized data stored back on message record
5. Acts aggregate processed messages by date range and work type

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database table definitions and Zod schemas
- `routes.ts`: API route definitions with input/output types
- `models/chat.ts`: Chat-specific table definitions

## External Dependencies

### AI Services
- **OpenAI API**: Used for natural language processing of work log messages. Configured via Replit AI Integrations with environment variables `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.

### Database
- **PostgreSQL**: Primary data store. Connection via `DATABASE_URL` environment variable. Schema managed with Drizzle Kit (`db:push` command).

### Key npm Packages
- `drizzle-orm` / `drizzle-zod`: Database ORM and schema validation
- `@tanstack/react-query`: Server state management
- `date-fns`: Date formatting and manipulation
- `framer-motion`: Animation library
- `zod`: Runtime type validation
- `openai`: OpenAI API client
- Full shadcn/ui component suite via Radix UI primitives

### Build & Development
- `tsx`: TypeScript execution for development
- `esbuild`: Server bundling for production
- `vite`: Frontend build tool