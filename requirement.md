# PRD Generation Prompt (English, Full Markdown Version)

## **Use this prompt to generate a complete, deeply detailed PRD for a real-time JavaScript tracking SDK**

---

## **📄 PRD GENERATION PROMPT**

### **PROMPT START**

You are a senior product manager and technical architect.  
Create a complete, deeply detailed Product Requirements Document (PRD) for the following product:

---

# **Product Summary**  
A JavaScript-based tracking SDK that allows any web application to monitor and record user interactions in real time without affecting performance. The SDK will send user activity events (clicks, navigation, scroll, inputs, errors, etc.) to a backend service built with Node.js (or any backend language), which stores the data in a database and optionally streams analytics to a real-time dashboard.

---

# **Your task**  
Create a **full PRD**, written in clear and professional English, with all necessary sections for engineering, design, analytics, QA, documentation, and future scalability. The PRD must be **complete, non-ambiguous, technically actionable, and implementation-ready**.

---

# **Required PRD Sections**  
The PRD MUST include the following in high detail:

### **1. Overview**
- High-level product description  
- Problem statement  
- Product goals  
- Non-goals  
- Target users (developers, product teams, analysts, etc.)  
- Success metrics  

### **2. Use Cases & User Stories**
Provide at least **15+ detailed user stories**, covering:
- Basic tracking  
- Custom event tracking  
- Batch event delivery  
- Real-time analytics  
- Error and performance logging  
- Integration into existing web apps  
- Dashboard monitoring  
- Data export  
- Multi-tenant usage  
- Developer setup and configuration  

### **3. Functional Requirements**
Very detailed functional specs, including:
- SDK initialization  
- Automatic event tracking rules  
- Configurable event types  
- Custom event API  
- Event batching mechanism  
- Retry and failure handling  
- Offline mode  
- Web Worker support  
- Privacy controls & opt-out  
- Session management  
- Unique user identification  
- API endpoint specifications  
- Rate limits  
- Admin dashboard features  
- Role-based access (if applicable)  

### **4. Technical Architecture**
Include deeply detailed explanations for:
- Frontend SDK architecture  
- Event lifecycle  
- Transport protocol choices (fetch, sendBeacon, WebSocket, HTTP fallback, etc.)  
- Backend service structure  
- Database schema for events  
- Event queue (Redis, Kafka, RabbitMQ—optional but described)  
- Real-time streaming layer  
- Load balancing & scalability strategy  
- Logging & monitoring  
- Deployment considerations  
- CDN hosting strategy for the SDK  

### **5. Data Schema & Storage Model**
Provide:
- Full event schema  
- Metadata fields  
- Session schema  
- User identity schema  
- Indexing strategies for millions of events  
- Retention policies  
- GDPR-compliant fields  
- Example JSON payloads  

### **6. Performance Requirements**
Define:
- Maximum SDK file size  
- Maximum allowed latency  
- Batch processing limits  
- Target events per second (EPS) per user and per system  
- Backend throughput requirements  
- Caching strategy  
- Expected resource consumption  

### **7. Security & Privacy Requirements**
Detailed requirements:
- Secure transmission  
- Token authentication  
- Domain whitelisting  
- SDK obfuscation  
- PII handling strategy  
- Consent management  
- Data anonymization  
- Compliance (GDPR, CCPA, etc.)  

### **8. API Specification**
Full API documentation for:
- `POST /events`  
- `POST /events/batch`  
- `GET /events`  
- WebSocket channel protocol  
Include:
- Headers  
- Error codes  
- Rate limits  
- Payload examples  

### **9. SDK Design Requirements**
Specify:
- SDK API methods  
- Naming conventions  
- Initialization options  
- Event collectors (click, scroll, input, navigation)  
- Plugin system for extending tracking  
- Debug mode  
- Error handling  
- Web Worker integration  
- NPM package structure  

### **10. Dashboard Requirements (Optional but detailed)**
- Real-time charts  
- Heatmap support (future)  
- User session replay (future)  
- Filters & segmentation  
- Export to CSV/JSON  
- Sharing reports  
- Authentication & roles  

### **11. Edge Cases**
Cover all unusual cases:
- User offline  
- Network unstable  
- User disables JS  
- Multiple tabs  
- Incognito tracking  
- High-load bursts  
- Browser compatibility issues  

### **12. Risks & Mitigation**
List at least **10+ risks** with mitigation strategies:
- Performance risks  
- Privacy risks  
- Scaling risks  
- Abuse/spam  
- Database growth  
- Incorrect event mapping  

### **13. Success Metrics & KPIs**
Provide measurable metrics such as:
- SDK adoption  
- Event accuracy  
- Latency targets  
- Data completeness  
- System uptime  
- Dashboard performance  

### **14. Release Plan**
- MVP scope  
- Beta scope  
- V1 scope  
- Feature roadmap (3–6 months)  

### **15. Appendices**
- Sequence diagrams  
- Sequence flow for event delivery  
- Example integration code for developers  
- Glossary  

---

# **Writing Style Requirements**
- Use professional, concise product management language  
- Avoid fluff; maximize clarity and precision  
- Use tables, diagrams (ASCII), bullet points, schemas  
- Make the PRD easy for engineers, designers, QA, and PMs to use  
- Ensure the PRD is appropriate for **any web application**  

---

**PROMPT END**