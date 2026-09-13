<div align="center">

# 🧠 SMRITI (स्मृति)

### Personalized cognitive care for elderly dementia patients — built for their language, their culture, their family.



**Problem Statement:** AI-Based Cognitive Gaming and Memory Assistance Platform for Elderly Dementia Patients in the North Eastern Region (NER) · MDoNER

</div>

---

## 📑 Table of Contents

- [🌱 Overview](#-overview)
- [🚀 Core Features](#-core-features)
- [💡 What Makes Smriti Different](#-what-makes-smriti-different)
- [🎮 Cognitive Activity System](#-cognitive-activity-system)
- [📈 Adaptive Difficulty](#-adaptive-difficulty)
- [🗣️ Multilingual + Voice](#️-multilingual--voice)

- [💊 Reminder & Care Support](#-reminder--care-support-system)
- [📡 Offline Architecture](#-offline-architecture)
- [🔐 Security & Privacy](#-security--privacy)
- [👥 User Roles](#-user-roles)
- [🛠️ Technology Stack](#️-technology-stack)
- [📊 Current Implementation Status](#-current-implementation-status)
- [⚖️ Responsible AI / Safety](#️-responsible-ai--safety)
- [🤝 Team](#-team)

---

## 🌱 Overview

Elderly dementia patients face a compounding set of challenges: declining memory and attention, limited access to specialized cognitive-care resources, and — particularly in India's North Eastern Region — language and cultural barriers that make most existing cognitive-care tools irrelevant to their daily lives. Caregivers, meanwhile, carry the burden of managing routines, reminders, and monitoring with little support.

**Smriti** turns each elderly user's own life — their family, photos, music, routines, and cultural background — into the raw material for personalized cognitive activities. A caretaker builds out a profile once; Smriti uses it to generate memory, attention, routine-recall, pattern/object-recognition, and emotional-engagement activities that:

- 🎯 Adapt in difficulty based on real performance
- 🌐 Work offline in low-connectivity areas
- 🗣️ Speak the user's own language
- ❤️ Feel personal, not generic

---

## ✅ SIH Problem Statement Alignment

| SIH Requirement | Smriti Implementation |
|---|---|
| 🧠 Memory improvement | Personalized memory-recall activities from family, photos, life context |
| 🎯 Attention and concentration | Dedicated Attention & Focus activity category |
| 📅 Daily routine recall | Daily Routine Recall activity, driven by caretaker-configured routines |
| 🧩 Pattern recognition | Pattern/Object Recognition activity category |
| 🔍 Object recognition | Pattern/Object Recognition activity category |
| ❤️ Emotional / mental engagement | Emotional Engagement activities using photos & music |
| 📈 Adaptive difficulty | Performance-based adaptive engine (Level 1–5) |
| 🗣️ Multilingual support | Assamese, Bengali, Hindi, English |
| 🔊 Voice assistance | Voice-assisted interaction layer |
| 🎭 NER cultural personalization | Bihu, tea gardens, Brahmaputra, Majuli themes |
| 💊 Medicine reminders | Caretaker-configured reminder system |
| 💧 Hydration reminders | Caretaker-configured reminder system |
| 📋 Daily activity reminders | Caretaker-configured reminder system |
| 🏥 Medical appointment reminders | Caretaker-configured reminder system |
| 👀 Caregiver monitoring | Caregiver/healthcare monitoring dashboard |
| 🩺 Healthcare-worker monitoring foundation | Role/authorization foundation in place *(🚧 TBD — exact feature scope)* |
| 📡 Offline functionality | Offline activity caching and sync |
| 📱 Mobile/tablet accessibility | *(🚧 TBD — confirm responsive/native support)* |
| 🔐 Secure patient data | Firebase Auth/Google OAuth, Firestore, relationship-aware authorization |
| 🤝 Social / emotional engagement | Family-based activities, many-to-many care relationships |

---

## 🚀 Core Features

### 👴 Elderly Experience
- 🖼️ Personalized memory space built from family, photos, music, and routines
- 🎮 Cognitive activities across five categories
- 🔊 Voice-assisted, multilingual interface
- 📴 Offline activity access with sync on reconnect

### 🧑‍💼 Caretaker Studio
- 🔗 Many-to-many caretaker ↔ elderly relationships
- 👨‍👩‍👧 Profile management: family, contacts, media uploads
- ⏰ Routine and reminder configuration
- 🌏 Language and NER cultural preference configuration
- 📊 Progress and performance insights

### 🧠 Cognitive Engine
- Memory · Attention & Focus · Daily Routine Recall · Pattern/Object Recognition · Emotional Engagement
- 📈 Performance-based adaptive difficulty (Level 1–5)

### 🔐 Security
- Firebase Authentication / Google OAuth
- Elderly/caretaker roles with relationship-aware, many-to-many authorization
- Firestore-based secure data storage

> 🚧 *TBD — protected-media access rules and further RBAC detail*

---

## 💡 What Makes Smriti Different

| # | Differentiator |
|---|---|
| 1️⃣ | **Personal memories become cognitive-game inputs** — activities generated from the user's own family, photos, and routines |
| 2️⃣ | **Performance-driven adaptive difficulty** — a Level 1–5 engine, not a fixed curriculum |
| 3️⃣ | **NER cultural and linguistic personalization** — Assamese, Bengali, Hindi, English + Bihu, tea gardens, Brahmaputra, Majuli |
| 4️⃣ | **Offline-first elderly experience** — built for low-connectivity NER settings |
| 5️⃣ | **Many-to-many caretaker ↔ elderly relationships** |
| 6️⃣ | **Caregiver and healthcare monitoring dashboard** |

---

## 🎮 Cognitive Activity System

| Activity | What It Does | Personalized Data Used |
|---|---|---|
| 🧠 Memory | Recall exercises from the user's own life | Family, photos, life events |
| 🎯 Attention & Focus | Sustained-attention tasks | *🚧 TBD* |
| 📅 Daily Routine Recall | Exercises around the user's actual routine | Caretaker-configured routines |
| 🧩 Pattern/Object Recognition | Recognition-based tasks | *🚧 TBD* |
| ❤️ Emotional Engagement | Activities built around music, photos, family | Music, photos, family relationships |

> 🚧 *TBD — specific performance signals per activity (accuracy, response time, attempts, hints, skips, completion)*

---

## 📈 Adaptive Difficulty

Smriti uses a **performance-based adaptive engine** — not a trained ML model. Difficulty is expressed as a level from **1 to 5**:

```text
📉 Low performance      → reduced difficulty  → more support
➡️  Stable performance   → maintain difficulty
📈 Strong performance    → increased difficulty → greater challenge
```

⚠️ This is a non-diagnostic, interaction-based mechanism. It does **not** detect or diagnose cognitive decline.

---

## 🗣️ Multilingual + Voice

**Supported languages:** 🇮🇳 Assamese · Bengali · Hindi · English

**Voice assistance:** Implemented *(🚧 TBD — browser speech synthesis, third-party TTS/STT, or full speech recognition?)*

---

## 🎭 NER Cultural Personalization

Cultural and regional context is woven into activity theming — including Bihu 🎉, tea gardens 🍃, the Brahmaputra 🌊, and Majuli 🏞️.

> 🚧 *TBD — full list of cultural personalization points and caretaker configuration flow*

---

## 💊 Reminder & Care Support System

Caretakers can configure reminders for:

| Type | Icon |
|---|---|
| Medicine | 💊 |
| Hydration | 💧 |
| Daily activity | 📋 |
| Medical appointment | 🏥 |

These are support tools, **not** medical/diagnostic features.

---

## 📡 Offline Architecture

```text
🌐 Online
   ↓
📦 Activity Cache
   ↓
📴 Offline Session
   ↓
🗂️ Local Queue
   ↓
🔌 Connection Restored
   ↓
🔄 Sync
   ↓
☁️ Firestore / Backend
```

> 🚧 *TBD — confirm whether sync is idempotent/duplicate-safe*

---

## 🔐 Security & Privacy

- 🔑 Firebase Google Authentication
- 👥 Elderly/caretaker roles, many-to-many relationship-aware authorization
- ☁️ Firestore-based secure data storage

> 🚧 *TBD — RBAC granularity, private media access rules, backend verification*

---

## 👥 User Roles

| Role | Capabilities |
|---|---|
| 👴 **Elderly User** | Receives personalized cognitive activities, reminders, family/media content |
| 🧑‍💼 **Caretaker** | Configures profiles, routines, reminders, media, language/culture; monitors progress |
| 🩺 **Healthcare Worker** | Authorization/monitoring foundation in place *(🚧 TBD — full scope)* |

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| 🔑 Authentication | Firebase Auth / Google OAuth | Login, role assignment |
| ☁️ Database | Cloud Firestore | Secure structured data storage |
| 🎨 Frontend | *🚧 TBD* | *🚧 TBD* |
| ⚙️ Backend | *🚧 TBD* | *🚧 TBD* |
| 🗄️ Storage | *🚧 TBD (Supabase migration — planned or verified?)* | Media storage (photos, videos, music) |
| 🧠 Cognitive Engine | Performance-based adaptive engine (non-ML) | Activity generation, difficulty adjustment |
| 🔊 Voice | *🚧 TBD* | Voice-assisted interaction |
| 📡 Offline | Local caching + sync queue | Offline activity execution |
| 🚀 Deployment | *🚧 TBD* | *🚧 TBD* |
| 🧪 Testing | *🚧 TBD* | *🚧 TBD* |

---

## 📊 Current Implementation Status

### ✅ Implemented & Verified
- 🔑 Firebase Auth / Google OAuth with elderly and caretaker roles
- 🔗 Many-to-many care relationships
- 🎨 Caretaker personalization: family, photos, videos, songs, routines, reminders, language, NER culture
- 🎮 Personalized, memory-based cognitive activity engine (5 categories)
- 📈 Performance-based adaptive difficulty engine (Level 1–5, non-ML)
- 🗣️ Multilingual support (Assamese, Bengali, Hindi, English) with voice assistance
- 🎭 NER cultural personalization (Bihu, tea gardens, Brahmaputra, Majuli)
- 📴 Offline activity caching and sync
- 👀 Caregiver/healthcare monitoring dashboard
- ☁️ Firestore-based secure data storage

### 🚧 In Progress
> *TBD — confirm from latest phase reports: Supabase migration status, healthcare-worker feature scope, testing coverage*

### 🔮 Future Extensions
> *TBD — e.g. advanced AI/ML models, face detection + caretaker labeling, OCR, semantic memory retrieval*

---

## ⚖️ Responsible AI / Safety

- 🚫 Activity performance is **not** a medical diagnosis
- 📈 Adaptive difficulty is based on observed interaction performance, not clinical assessment
- 💊 Reminder and care-support features are non-diagnostic
- 🩺 Healthcare-worker access is authorization-controlled
- 🔒 Sensitive credentials are never exposed to the frontend

---

## 🤝 Team

<div align="center">

### `FourBits'

| Hrisit | Shreejata | Sruti | Aryan |
|---|---|---|---|---|---|

</div>

---

<div align="center">



> 📝 *Sections marked 🚧 TBD need confirmation from your full phase-by-phase implementation reports (test results, API routes, project structure, deployment platform, env vars, storage-migration status) before this is submission-ready.*

</div>
