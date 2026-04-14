from copy import deepcopy
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import re
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture"
PR_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
XML_NS = "http://www.w3.org/XML/1998/namespace"
ET.register_namespace("w", W_NS)
ET.register_namespace("a", A_NS)
ET.register_namespace("r", R_NS)
ET.register_namespace("wp", WP_NS)
ET.register_namespace("pic", PIC_NS)
NS = {"w": W_NS}

W = f"{{{W_NS}}}"
A = f"{{{A_NS}}}"
R = f"{{{R_NS}}}"
WP = f"{{{WP_NS}}}"
PIC = f"{{{PIC_NS}}}"
PR = f"{{{PR_NS}}}"


TEMPLATE_PATH = Path("/Users/wbh/Desktop/2025-26 Final Report Template.docx")
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "Club_Enrolment_Portal_Final_Report_Draft.docx"


TITLE = "Club Enrolment Portal: A Multi-Page Web Platform for Club Discovery, Booking and Community Management"
DEGREE = "Computer Science"
AUTHOR = "Beihong Wang"
DATE = "April 2026"


def para(text):
    return " ".join(text.split())


SECTION_CONTENT = {
    "Abstract": [
        (
            "This report presents Club Enrolment Portal, a cloud-backed web platform "
            "designed to centralise club discovery, session booking, course enrolment, "
            "community interaction and operational management within one system. The "
            "project addresses a common problem in student club ecosystems: information "
            "is usually scattered across social media posts, booking records are handled "
            "inconsistently, and communication between members, club managers and "
            "administrators is fragmented. To address this, the project combines a public "
            "home page, club preview pages, club detail pages, a booking flow, course "
            "browsing and enrolment, a forum, a support centre, a user dashboard, a club "
            "management dashboard and an admin dashboard. The front end was implemented "
            "as a static multi-page application using HTML, CSS, JavaScript and Vue, "
            "while Supabase was used for authentication, structured data storage and media "
            "storage, and Vercel was used for deployment. The completed prototype supports "
            "email and Google-based sign-in, persistent bookings, course favourites, forum "
            "posting, support messaging and role-aware management tools. Testing was "
            "performed through scenario-based functional checks and deployment QA across "
            "all major user journeys. The outcome is a working end-to-end portal that "
            "demonstrates how a modern university club platform can improve service "
            "consistency, reduce friction in user participation and provide a stronger "
            "foundation for future expansion."
        )
    ],
    "Acknowledgements": [
        (
            "I would like to thank my supervisor, the module team and the peers who "
            "reviewed the system during development. Their feedback on usability, visual "
            "consistency, content organisation and feature priorities helped shape the "
            "project into a more coherent platform. I would also like to acknowledge the "
            "support of the documentation and tooling provided by Supabase, Vercel, Vue "
            "and Google OAuth, which made it possible to move from a locally driven "
            "prototype towards a deployable cloud-backed system."
        )
    ],
    "Introduction": [
        (
            "Club Enrolment Portal is an end-to-end digital platform intended to support "
            "students as they discover clubs, review schedules, book sessions, join "
            "courses, participate in community discussion and contact support, while also "
            "supporting club managers and administrators through dedicated back-office "
            "views. The project was motivated by the observation that club participation "
            "is often hindered by fragmented information, inconsistent booking methods and "
            "the absence of a single environment in which students can browse, join and "
            "manage their activity records."
        ),
        (
            "The report is organised around the same software engineering structure used "
            "in the reference reports. It begins by introducing the problem domain and "
            "project objectives, then reviews the relevant literature and engineering "
            "principles, defines the functional and non-functional requirements, explains "
            "the design and implementation of the platform, discusses testing and "
            "evaluation, and closes with external concerns, project management lessons and "
            "conclusions."
        ),
    ],
    "Background to the project": [
        (
            "University clubs frequently rely on informal communication channels such as "
            "chat groups, posters, spreadsheets and social posts. These channels are useful "
            "for publicity but poor at maintaining reliable service records. Students may "
            "see a club advertised online but still struggle to understand where it meets, "
            "how to join, whether spaces remain, or how their past bookings and favourites "
            "can be reviewed later. Club owners may similarly struggle to maintain up-to-date "
            "club information, publish courses and manage attendance using disconnected tools."
        ),
        (
            "This project was therefore framed as a practical software engineering response "
            "to a realistic campus-management problem. Instead of producing a single isolated "
            "feature, the project aimed to create an integrated platform in which the public "
            "front end, user account features, cloud persistence and management workflows all "
            "support one another. The result is not merely a static showcase website, but a "
            "working portal with user roles, stored records, repeatable booking flows and "
            "multiple operational interfaces."
        ),
    ],
    "Aims and objectives": [
        (
            "The overall aim of the project was to design and implement a usable web portal "
            "that centralises the main activities associated with club participation and club "
            "operations. The system needed to be understandable for first-time visitors while "
            "also being capable of supporting authenticated and role-based workflows."
        ),
        (
            "The specific objectives were to: provide a clear public-facing home page; allow "
            "users to preview clubs and open richer detail pages; support club session booking "
            "and course enrolment with persistent cloud data; allow users to favourite courses "
            "and review their own records; provide a forum and support channel to improve "
            "community interaction; implement a club management dashboard for content and "
            "activity administration; create an admin view for platform-level oversight; and "
            "deploy the system online so that local and production behaviour remain consistent."
        ),
    ],
    "Research question": [
        (
            "The central research question for the project was: can a cloud-backed, "
            "multi-page web application provide a coherent and reliable environment for "
            "club discovery, booking, course participation and club management, while "
            "remaining understandable for ordinary student users and manageable for club "
            "owners and administrators?"
        )
    ],
    "Literature review": [
        (
            "The project sits at the intersection of interaction design, reservation systems, "
            "community platforms and cloud-based web application engineering. Interaction "
            "design literature argues that systems used by diverse user roles should reduce "
            "cognitive load, maintain consistency across screens and provide clear feedback "
            "after important actions (Preece, Rogers and Sharp, 2015). Nielsen (1994) makes "
            "a similar case through usability heuristics such as visibility of system status, "
            "consistency and standards, error prevention and user control. These principles "
            "were especially relevant because this platform includes both public browsing pages "
            "and authenticated management workflows."
        ),
        (
            "From a software engineering perspective, requirements capture, traceability and "
            "modular design are central to controlling project scope and maintaining quality "
            "(Sommerville, 2016). A club platform naturally involves multiple related data "
            "entities, including users, clubs, time slots, bookings, courses, forum posts "
            "and support messages. Without clear data modelling, such systems quickly become "
            "difficult to maintain. The design of this project therefore treated data structure "
            "definition and page-to-service separation as core engineering concerns rather than "
            "afterthoughts."
        ),
        (
            "Security and privacy are also important in any platform that stores personal "
            "profiles, booking histories and user-generated content. OWASP (2021) highlights "
            "broken access control, insecure design and sensitive data exposure as recurring "
            "web risks. This project did not attempt to build a custom authentication provider; "
            "instead it used Supabase Authentication and later integrated Google OAuth so that "
            "identity, session handling and cloud persistence were handled through established "
            "services. This decision reduced implementation complexity while improving the "
            "credibility of the authentication workflow."
        ),
        (
            "Finally, modern backend-as-a-service tools influence how small and medium-scale "
            "student projects can be delivered. Supabase documentation (Supabase, 2026) and "
            "Vercel deployment guidance (Vercel, 2026) illustrate how managed authentication, "
            "database services, storage and serverless helpers can accelerate delivery without "
            "removing the need for careful architecture and testing. The project therefore "
            "combined academic software engineering principles with practical cloud tooling in "
            "order to produce a system that was both implementable within the module timeframe "
            "and credible as a real-world service prototype."
        ),
    ],
    "Requirements": [
        (
            "The requirements for Club Enrolment Portal were developed from the intended user "
            "journeys of three main stakeholder groups: general users, club managers and platform "
            "administrators. The system had to support discovery, enrolment and community use for "
            "ordinary members while also providing operational capabilities for staff-like roles. "
            "Because the project evolved from a more static prototype into a persistent cloud-backed "
            "platform, the requirements also included deployment consistency, data persistence and "
            "a reduction in local-only behaviour."
        )
    ],
    "Product requirements": [
        (
            "At product level, the software needed to function as a central portal rather than a "
            "single-feature page. It had to let users browse clubs, inspect detailed club pages, "
            "book sessions, enrol in courses, communicate through a forum, send support messages "
            "and review their personal activity records. It also needed to provide club owners with "
            "the ability to maintain club content, publish courses and manage activities, and give "
            "administrators an overview of the system."
        )
    ],
    "Functional requirements": [
        (
            "The functional requirements were divided into interface expectations, capability "
            "requirements, data needs and quality-related constraints. This made it easier to map "
            "requirements directly to concrete pages, services and tests."
        )
    ],
    "Interfaces": [
        (
            "The platform needed a responsive web interface with clear separation between public "
            "pages and authenticated pages. Core interfaces included the home page, club preview "
            "page, club detail pages, booking and payment pages, course pages, forum, support "
            "centre, user dashboard, club management dashboard and admin dashboard. Shared headers, "
            "shared auth controls and reusable detail-page elements were required to keep navigation "
            "consistent."
        )
    ],
    "Functional Capabilities": [
        (
            "The system needed to support account registration and login, Google sign-in, user profile "
            "management, club browsing, category filtering, detailed club pages with venue information, "
            "club slot booking, a simulated payment confirmation flow, course booking and favourites, "
            "forum posting with comments and likes, direct/support messaging, club creation and editing, "
            "member management, course publishing and platform-level supervision."
        )
    ],
    "Performance Levels": [
        (
            "The portal needed to feel responsive on typical modern laptop and mobile browsers, "
            "especially for navigation, filtering, booking confirmation and dashboard refresh. It "
            "was also important that a completed action, such as creating a booking or posting a "
            "forum comment, remained visible after refresh rather than existing only in local browser state."
        )
    ],
    "Data Structures/Elements": [
        (
            "The data model required structured support for profiles, clubs, club slots, club members, "
            "club bookings, courses, course bookings, course favourites, forum posts, forum comments, "
            "support threads, support messages and login events. These entities were represented directly "
            "in the Supabase schema so that user actions across different parts of the system could be "
            "linked and persisted."
        )
    ],
    "Safety": [
        (
            "Because the project does not involve custom hardware, safety concerns are primarily digital "
            "and operational. The interface should avoid misleading users about booking success, venue "
            "accuracy or account state. Venue details, remaining seats and mode labels should be presented "
            "clearly so that a user does not make a booking based on false assumptions."
        )
    ],
    "Reliability": [
        (
            "The portal needed to behave reliably across refreshes, browsers and production deployments. "
            "A booking or favourite should not disappear after the page reloads, and the online version "
            "should not diverge from the local version because of broken asset paths or missing fallback logic. "
            "This requirement became particularly important as the system moved from static demo content to "
            "cloud-persisted records."
        )
    ],
    "Security/Privacy": [
        (
            "Security and privacy requirements included authenticated access to personal records, separation "
            "between ordinary member and management behaviours, careful handling of profile information, and "
            "a trusted login flow. The system therefore uses Supabase Authentication, structured user roles "
            "and cloud-hosted storage rather than exposing private operations through unauthenticated page actions."
        )
    ],
    "Quality": [
        (
            "The quality goal was to produce a portal that looked coherent and felt maintainable. This involved "
            "consistent naming, shared UI helpers, reusable data mappings for club covers, clearer error messages, "
            "in-page custom dialogs instead of inconsistent browser alerts, and alignment between booking, course "
            "and management interfaces."
        )
    ],
    "Constraints and Limitations": [
        (
            "The main constraints were time, the academic project schedule, the decision to keep a multi-page "
            "HTML structure rather than rewriting everything as a single SPA, and the reliance on third-party "
            "services for hosting, database functionality and authentication. In addition, the payment flow "
            "remained a simulated preview rather than a real payment gateway, which limited the realism of the "
            "commercial booking process."
        )
    ],
    "Performance requirements": [
        (
            "The system should support fast page-to-page navigation, low-friction filtering and smooth completion "
            "of critical user tasks such as booking, saving favourites and opening dashboards. It should also "
            "preserve data consistency between local and deployed environments and degrade gracefully if some cloud "
            "data is temporarily unavailable."
        )
    ],
    "Design constraints": [
        (
            "The design was constrained by the decision to deploy through Vercel and persist data through Supabase, "
            "which influenced URL routing, authentication, storage and serverless helper choices. The project also "
            "had to remain deliverable as an individual academic submission, so it needed a balance between ambitious "
            "feature scope and practical maintainability."
        )
    ],
    "Design": [
        (
            "The design phase translated the requirements into a set of coordinated front-end pages, shared service "
            "modules and a structured data model. Particular attention was paid to separating user-facing pages from "
            "management pages while still keeping a recognisable visual and navigational relationship between them."
        )
    ],
    "Software design": [
        (
            "At architectural level, the portal uses a multi-page front end built from HTML, CSS and JavaScript, "
            "with Vue used to manage local page state on feature-heavy screens such as club preview, booking, courses, "
            "forum and the user centre. Vercel redirects map short routes such as `/login`, `/clubs`, `/booking` and "
            "`/courses` to the correct HTML entry points. This keeps deployment simple while still producing a more "
            "application-like experience."
        ),
        (
            "The data layer is organised around shared Supabase service scripts. Separate modules handle bookings, "
            "courses, forum data, support data, storage, club administration and local fallback or migration logic. "
            "This service split reduces duplication and makes it clearer which page is responsible for which business "
            "operation. The Supabase schema provides linked entities for profiles, clubs, slots, bookings, courses, "
            "forum content and support messages, allowing the user dashboard and management dashboards to assemble "
            "data from a common source."
        ),
        (
            "Several reusable UI helpers were created to improve maintainability. Shared header logic manages "
            "login-aware navigation; detail page helpers render back buttons and club detail elements consistently; "
            "custom in-page dialogs replace inconsistent browser alerts; and cover-image fallback mappings keep club "
            "cards, course cards and detail pages visually aligned. A small serverless helper resolves map links "
            "for more accurate venue embedding on detail pages."
        )
    ],
    "Hardware design": [
        (
            "This project does not involve custom hardware, embedded systems or electronics. The hardware context is "
            "therefore limited to ordinary end-user devices such as laptops and mobile phones running modern browsers. "
            "For that reason, hardware design was not a major part of the project and the main implementation focus "
            "remained on software architecture, cloud services and interface design."
        )
    ],
    "Experimental design": [
        (
            "The evaluation design was scenario based. Instead of relying on one isolated test script, the system was "
            "tested through realistic task sequences for multiple user roles. For example, a normal user account was "
            "used to register, browse clubs, create bookings, enrol in courses and post in the forum; a second user "
            "account was used to validate likes, comments and direct interactions; and a manager account was used to "
            "test club creation, editing, member management and course publishing."
        ),
        (
            "These scenarios were captured in a structured online QA checklist covering authentication, club booking, "
            "courses, forum behaviour, support messaging, dashboard actions and storage uploads. This approach provided "
            "traceability between requirements, implemented features and practical test evidence, while also making it "
            "possible to repeat checks after each online deployment."
        )
    ],
    "Implementation and testing": [
        (
            "Implementation and testing were closely linked throughout the project. The portal was not built in a "
            "single pass; instead, pages and services were progressively refined as bugs, alignment issues and cloud "
            "consistency problems were identified. This section therefore discusses implementation decisions together "
            "with the verification activity that supported them."
        )
    ],
    "Implementation": [
        (
            "The implementation began with a set of user-facing pages and gradually expanded into a larger platform. "
            "Initial static pages for club discovery, booking, courses and support were extended with persistent cloud "
            "data, reusable cover-image mappings and shared header behaviour. Club-specific detail pages were created "
            "under a dedicated `html/club/` directory, while more dynamic features were moved into shared JavaScript "
            "modules to reduce repetition."
        ),
        (
            "Supabase was integrated as the central runtime service. It provides authentication, the relational data "
            "store and media storage used across the platform. A structured SQL schema defines the core entities and "
            "their relationships. This made it possible to move away from purely local demo state and towards features "
            "that persist across refreshes and browsers, such as bookings, course favourites, forum posts and support "
            "records."
        ),
        (
            "Deployment considerations influenced implementation choices throughout. Vercel redirects were configured "
            "to create cleaner public entry routes, local-only file path problems were removed from media references, "
            "and production QA tasks were used to keep the online version aligned with the local version. Additional "
            "refinements, such as custom page dialogs, back buttons on detail pages, Google sign-in support and map "
            "fallback logic, improved usability and reduced friction in high-value user journeys."
        )
    ],
    "Testing": [
        (
            "Testing combined code-level checks with scenario-driven manual validation. For JavaScript-heavy pages and "
            "shared modules, syntax validation such as `node --check` was used during development to reduce trivial "
            "runtime errors. At workflow level, test scenarios were executed against the deployed site after changes "
            "were pushed to ensure that authentication, booking persistence, forum updates and dashboard edits still behaved correctly."
        ),
        (
            "The online QA checklist acted as the main acceptance testing document. It included registration and login, "
            "session booking and cancellation, course booking and favourites, forum posts and replies, support messages, "
            "media uploads and club manager dashboard tasks. This was particularly useful because the system spans several "
            "distinct subsystems and a bug in one area can affect confidence in another."
        ),
        (
            "Testing also highlighted current limitations. The payment stage remains a preview-only simulated success flow, "
            "so it validates user interface logic and booking state changes rather than real transaction processing. "
            "Automated test coverage is still limited, meaning that regression prevention currently relies more heavily "
            "on repeated scenario testing than would be ideal in a commercial product."
        )
    ],
    "External concerns": [
        (
            "Although the system was developed as an academic project, its features imply several broader concerns. "
            "Because the portal handles profile data, bookings, uploaded media and user-generated discussion content, "
            "its design must be considered not only in terms of technical correctness but also in terms of responsibility, "
            "fairness and future deployment implications."
        )
    ],
    "Legal, social and ethical issues": [
        (
            "The main legal and ethical concern is the handling of personal and behavioural data. Even a university club "
            "platform can store sensitive information indirectly through names, profile fields, message histories, media "
            "uploads and booking records. The system should therefore minimise unnecessary data capture, present users "
            "with clear account and content actions and avoid exposing management features to unauthorised users."
        ),
        (
            "There are also social and moderation concerns. Forum and messaging features can improve community engagement, "
            "but they also create opportunities for harassment, exclusion or misinformation if they are not controlled "
            "properly. For this reason, administrator oversight and content management were treated as platform concerns "
            "rather than optional extras. Accessibility is another ethical issue: if club information is only readable on "
            "large screens or only discoverable through complex navigation, the platform would disadvantage some users."
        ),
        (
            "Finally, transparency matters. Because payment is simulated in the current prototype, the interface should "
            "not mislead users into thinking that a real financial transaction has been processed. Likewise, third-party "
            "login services such as Google OAuth should be clearly understood as external identity providers rather than "
            "in-house authentication mechanisms."
        )
    ],
    "Commercial issues and exploitation": [
        (
            "The project has commercial potential as a white-label platform for universities, student unions, sports "
            "centres or independent club networks that need a unified system for discovery, booking and community "
            "engagement. The strongest commercial value lies in integrating activities that are often split across "
            "separate tools: publicity, bookings, attendance, courses, messaging and light-touch administration."
        ),
        (
            "A future commercial version would require clearer subscription planning, real payment processing, more "
            "robust analytics, stronger moderation tools and formal accessibility review. Costs would include hosting, "
            "authentication and storage services, email or notification infrastructure, maintenance time and support. "
            "Potential revenue could come from institutional licensing, premium management tools or transaction-linked services."
        )
    ],
    "Evaluation and discussion of results": [
        (
            "Overall, the project meets its central goal of delivering a connected club platform rather than a set of "
            "isolated demonstration pages. The system now supports an identifiable end-to-end flow from discovery to "
            "booking and from participation to review in a user dashboard. The addition of cloud persistence, shared "
            "cover mappings, manager workflows and production deployment significantly improved the realism of the prototype."
        ),
        (
            "The strongest result is functional breadth. Users can register, log in, browse clubs, open accurate club "
            "detail pages, book sessions, book courses, save favourites, post in the forum, send support messages and "
            "review their records. Club managers can publish and update club content, and administrators have a clearer "
            "overview interface. This breadth demonstrates successful integration across multiple feature domains."
        ),
        (
            "However, the evaluation also reveals limits. The portal still relies on a multi-page static structure that "
            "can lead to duplicated logic if not carefully managed. Automated testing remains limited, the payment stage "
            "is not yet real, and some workflows still depend on careful configuration in external services such as "
            "Supabase and Google Cloud. These issues do not invalidate the project, but they do mark the boundary between "
            "a strong academic prototype and a production-ready commercial system."
        )
    ],
    "Programme specific concerns": [
        (
            "From a Computer Science perspective, the project demonstrates competence in requirements analysis, data "
            "modelling, interface design, front-end implementation, cloud integration, deployment and iterative testing. "
            "It also shows awareness of security, privacy, usability and maintainability concerns. The system is "
            "particularly strong as evidence of applied software engineering because it combines design thinking with "
            "practical implementation details such as schema definition, routing, role-aware behaviour and deployment QA."
        )
    ],
    "Conclusion": [
        (
            "Club Enrolment Portal developed from a front-end heavy prototype into a more credible cloud-backed platform. "
            "The project demonstrates that a student club ecosystem can be represented effectively through a multi-page "
            "web application if the design keeps user goals, data consistency and operational roles in view throughout "
            "the development process."
        )
    ],
    "Project management": [
        (
            "The project was managed iteratively rather than through a rigid once-only waterfall process. New requirements "
            "emerged as visual inconsistencies, deployment issues and data persistence problems were discovered, so the "
            "development process involved frequent refinement of existing pages alongside implementation of new features. "
            "This proved appropriate for the project because many important improvements were only visible once the system "
            "was tested across several related pages."
        ),
        (
            "In practice, progress was driven by a sequence of small deliverables: aligning local and production behaviour, "
            "adding new clubs and courses, improving booking flows, refining dashboards, standardising images, replacing "
            "native browser dialogs, improving authentication and reducing UX friction. This incremental approach helped "
            "maintain momentum and kept the project aligned with user-facing outcomes rather than abstract technical tasks alone."
        )
    ],
    "Risk management": [
        (
            "Several risks affected the project. The first was divergence between local and deployed behaviour, especially "
            "when image paths or local-only fallbacks behaved differently online. The second was dependency risk: because "
            "the system relies on Supabase and Vercel, authentication settings, redirect URLs and storage configuration "
            "could block a feature even when the front-end code was correct. The third was scope risk, as the desire to "
            "support many feature areas could easily have led to shallow or inconsistent implementation."
        ),
        (
            "These risks were mitigated through repeated deployment checks, conservative use of shared helper scripts, "
            "fallback logic for covers and maps, and a willingness to simplify where necessary. For example, payment was "
            "left explicitly as a simulated confirmation flow rather than forcing an incomplete real transaction system "
            "into the project. This kept the prototype honest while still demonstrating the intended booking journey."
        )
    ],
    "General conclusions": [
        (
            "The project makes a useful contribution as a realistic prototype for digital club management. It shows how a "
            "single platform can unify discovery, participation, communication and administration for student clubs, and "
            "it does so in a way that is understandable to users and extensible by developers. The core research question "
            "can therefore be answered positively: a cloud-backed multi-page web application can provide a coherent and "
            "reliable club platform, provided that requirements, data models, deployment details and usability concerns "
            "are considered together rather than separately."
        ),
        (
            "Future work should focus on automated testing, stronger admin moderation tools, more rigorous accessibility "
            "review, real payment integration, richer analytics and further reduction of duplicated page-level logic. "
            "Even so, the current project already stands as a substantial software engineering artefact rather than a "
            "purely visual mock-up."
        )
    ],
    "References": [
        "Google (2026) OAuth 2.0 for Web Server Applications. Available at: https://developers.google.com/identity/protocols/oauth2/web-server (Accessed: 11 April 2026).",
        "Nielsen, J. (1994) Usability Engineering. San Francisco: Morgan Kaufmann.",
        "OWASP Foundation (2021) OWASP Top Ten. Available at: https://owasp.org/www-project-top-ten/ (Accessed: 11 April 2026).",
        "Preece, J., Rogers, Y. and Sharp, H. (2015) Interaction Design: Beyond Human-Computer Interaction. 4th edn. Chichester: Wiley.",
        "Sommerville, I. (2016) Software Engineering. 10th edn. Harlow: Pearson.",
        "Supabase (2026) Supabase Documentation. Available at: https://supabase.com/docs (Accessed: 11 April 2026).",
        "Vercel (2026) Vercel Documentation. Available at: https://vercel.com/docs (Accessed: 11 April 2026).",
        "Vue.js (2026) Guide. Available at: https://vuejs.org/guide/ (Accessed: 11 April 2026).",
    ],
    "Appendix A – Repository structure and key files": [
        (
            "The repository is organised into clear functional groups. The `html/` directory contains the page entry "
            "points, including `index1.html` for the home page, `join.html` for authentication and the user centre, "
            "`msjs.html` for club preview, `specialty.html` for club booking, `mfms.html` and `mfms-detail.html` for "
            "courses, `spjs.html` for the forum, `tzgg.html` for support, and the separate management dashboards."
        ),
        (
            "The `js/` directory contains shared runtime logic such as Supabase configuration, booking and course services, "
            "forum and support services, shared auth helpers, custom dialogs and detail page helpers. The `css/` directory "
            "contains page-specific stylesheets. The `supabase/` directory contains the schema and SQL scripts used to "
            "initialise or clean the cloud data model, while `api/resolve-map.js` provides a small serverless helper for "
            "map resolution and `vercel.json` defines user-facing route redirects."
        )
    ],
    "Appendix B – Manual QA checklist summary": [
        (
            "The deployment QA checklist covers authentication, booking, courses, forum behaviour, message flows, support "
            "records, club manager operations and storage uploads. Example checks include registering a new account, "
            "creating a booking, validating course favourites, liking and commenting on forum posts, exchanging messages "
            "between users and confirming that uploaded media remains available after refresh."
        ),
        (
            "This checklist is especially important because the system spans several connected subsystems. A change to "
            "authentication can affect booking, a storage problem can affect the forum and profile pages, and a content "
            "change can affect both local and production behaviour. Repeating scenario-based QA after deployment therefore "
            "provides essential confidence in the overall integrity of the portal."
        )
    ],
}


SECTION_CONTENT["Abstract"].append(
    "In addition to implementing the main user journeys, the project also explores how iterative "
    "refinement can improve a front-end heavy prototype over time. Several later development stages "
    "focused on consistency between local and deployed behaviour, improvement of shared UI helpers, "
    "stronger data persistence and the reduction of design friction through better alignment, clearer "
    "navigation and more reliable authentication behaviour."
)

SECTION_CONTENT["Introduction"].append(
    "Three stakeholder perspectives shaped the project throughout development. A general user expects "
    "clarity, speed and confidence when deciding whether to join a club or book a slot. A club manager "
    "expects control over club information, schedules and members. A platform administrator expects a "
    "high-level view of activity and a basis for moderation and operational review. The system therefore "
    "had to balance ease of use with functional depth."
)

SECTION_CONTENT["Background to the project"].append(
    "Another important background factor was the mismatch between promotional content and operational content. "
    "A club may look active on posters or social media, but that does not guarantee that booking, attendance "
    "records and follow-up communication are handled in a reliable way. The project therefore aimed to bridge "
    "the gap between attractive front-end presentation and dependable back-end record keeping."
)

SECTION_CONTENT["Literature review"].extend(
    [
        (
            "Reservation and enrolment systems also provide useful lessons. A good booking system needs more than "
            "a calendar interface; it needs clear capacity information, confirmation states, repeatable workflows "
            "and recoverable records. In the context of this project, this meant that club slots, booking records, "
            "payment states and user dashboards had to be considered as one workflow rather than as isolated screens."
        ),
        (
            "Community system literature is equally relevant. Forums and message spaces can increase retention and "
            "a sense of belonging, but only if participation is lightweight and trust is preserved. This influenced "
            "the design of the forum and support areas, where users can post, comment, like and send messages while "
            "still operating inside the same account environment as their bookings and club activity."
        ),
    ]
)

SECTION_CONTENT["Requirements"].append(
    "To keep scope manageable, the requirements were framed around demonstrable user tasks rather than abstract "
    "feature lists alone. A requirement was treated as successful only if it could be traced to a visible page, "
    "a persistent data record or a repeatable QA scenario."
)

SECTION_CONTENT["Product requirements"].extend(
    [
        (
            "The product therefore had to serve as both an information system and an interaction system. It needed "
            "to persuade users to explore clubs through a polished front end, but it also needed to record what "
            "happened after a user clicked through, booked, posted, saved or contacted support."
        ),
        (
            "Figure 1 summarises the principal actor-to-feature relationships used during scoping. It highlights "
            "that the portal was designed around role-specific responsibilities rather than one undifferentiated user type."
        ),
    ]
)

SECTION_CONTENT["Functional Capabilities"].append(
    "These capabilities were intentionally distributed across several linked pages. For example, a user might "
    "discover a club on the home page, inspect it on a preview card, review venue details on a detail page, book "
    "a slot in the booking centre and then later confirm the record inside the user centre. This cross-page continuity "
    "was part of the functional requirement, not just a visual preference."
)

SECTION_CONTENT["Data Structures/Elements"].extend(
    [
        (
            "The relational model also had to support different forms of linkage. Some records are user-to-club "
            "relationships, such as club memberships and bookings. Others are user-to-content relationships, such as "
            "forum posts, comments and favourites. Others again are operational records, such as login events and "
            "support threads. Treating these as first-class entities made it easier to reason about permissions and persistence."
        ),
        (
            "Figure 2 gives a simplified view of the most important data groups and their relationship to each other. "
            "The full SQL schema is more detailed, but the diagram captures the design intent that shaped both the page logic and the dashboards."
        ),
    ]
)

SECTION_CONTENT["Security/Privacy"].append(
    "The system also needed to avoid embedding secrets or trust-critical logic in the front end. Anonymous public keys "
    "can be exposed safely for Supabase client access, but privileged operations still depend on authenticated sessions, "
    "cloud-side policies and correct role handling."
)

SECTION_CONTENT["Design"].append(
    "The design process also considered how to minimise repeated maintenance effort. Features such as shared auth-aware "
    "headers, consistent club cover mappings, reusable detail headers and common dialog behaviour were introduced because "
    "small repeated inconsistencies were becoming expensive in both development time and user confidence."
)

SECTION_CONTENT["Software design"].extend(
    [
        (
            "Figure 3 presents the high-level software architecture. The diagram shows how user roles interact with the "
            "front-end pages, how shared client-side helpers sit between page state and cloud services, and how Supabase "
            "and Vercel together support authentication, persistence, storage and deployment."
        ),
        (
            "A notable design decision was to keep the system as a structured multi-page web application rather than forcing "
            "all features into a single-page architecture. This made it easier to preserve clear entry points and simpler "
            "deployment through static routes, while Vue-based page logic still provided dynamic behaviour where it was most needed."
        ),
        (
            "Another design focus was consistency between domains that users perceive as related. If a club card, course card "
            "and club detail page represent the same entity, they should not show contradictory cover images, venue information "
            "or navigation expectations. For that reason, several iterations concentrated on shared mappings and fallback rules."
        ),
    ]
)

SECTION_CONTENT["Experimental design"].append(
    "Acceptance criteria were defined around completion and persistence. A workflow was not treated as fully successful merely "
    "because a button could be clicked. It also had to show correct state after refresh, appear in the correct dashboard area "
    "and, where relevant, remain visible across browsers or after re-authentication."
)

SECTION_CONTENT["Implementation"].extend(
    [
        (
            "Implementation also involved considerable content alignment work. New club entries had to be added consistently "
            "to preview pages, booking pages, local fallback datasets and individual club detail pages. Image assets needed "
            "to be standardised so that the same club was represented consistently across pages. These tasks may appear cosmetic, "
            "but they were central to the credibility of the portal."
        ),
        (
            "Authentication behaviour was refined in later stages. Email confirmation messaging was simplified when Supabase "
            "settings changed, and Google sign-in was integrated through Supabase OAuth and Google Cloud configuration. This "
            "demonstrated that the portal could evolve from a purely local sign-in flow into a more realistic identity model."
        ),
    ]
)

SECTION_CONTENT["Testing"].append(
    "Visual regression and layout consistency were also checked manually because the project contains several dense card-based "
    "interfaces. Alignment of buttons, information panels, course times, images and navigation elements mattered for usability, "
    "so testing included not only data correctness but also whether the interface still looked coherent after updates."
)

SECTION_CONTENT["External concerns"].append(
    "Because the project presents itself as a joined-up service, user expectations are likely to be higher than for a simple "
    "demonstration website. This increases the importance of responsible communication, accurate status reporting and realistic "
    "feature labelling."
)

SECTION_CONTENT["Evaluation and discussion of results"].extend(
    [
        (
            "The design and implementation decisions also produced valuable practical lessons. First, consistency work is not "
            "secondary work in a platform project; it is part of the core value proposition. Second, using cloud services can "
            "greatly accelerate delivery, but only if redirect URLs, provider settings and deployment assumptions are managed carefully. "
            "Third, scenario-based QA remains powerful when feature areas are tightly connected."
        ),
        (
            "From a usability perspective, the project improved substantially over time through many small changes: more accurate "
            "maps, cleaner category filtering, better button destinations, custom modal dialogs, better card alignment, removal of "
            "confusing labels and more reliable fallback behaviour. These changes are important because they reflect response to "
            "observed friction rather than speculative optimisation."
        ),
    ]
)

SECTION_CONTENT["Project management"].append(
    "Documentation also became part of the management process. Repository guides, release notes and QA checklists made it easier "
    "to understand the growing codebase and to keep deployment tasks visible. This was useful both for maintenance and for preparing "
    "the project to be explained in a report or defence setting."
)

SECTION_CONTENT["Risk management"].append(
    "A further risk concerned external provider branding and configuration, especially during Google OAuth integration. Even when "
    "the application code was correct, user experience could still be affected by provider branding screens, callback URLs and "
    "testing restrictions. This reinforced the lesson that platform integration work includes operational setup as well as coding."
)

SECTION_CONTENT["General conclusions"].append(
    "Most importantly, the project shows that integration work can itself be the main contribution. The value of the portal does "
    "not come from an isolated algorithm or one novel UI component, but from coordinating identity, records, communication, "
    "navigation and management into one coherent service."
)

SECTION_CONTENT["Appendix A – Repository structure and key files"].append(
    "The most important runtime configuration files include `js/supabase-config.js`, which defines the client URL and public key, "
    "`supabase/schema.sql`, which defines the main relational entities, and `vercel.json`, which maps human-friendly routes to the "
    "appropriate page entry points. These files are useful for understanding how the deployed platform operates as a unified system."
)

SECTION_CONTENT["Introduction"].extend(
    [
        para(
            """
            A further motivation for the project was the need to create a system that could be explained clearly to
            non-technical stakeholders. Many student-facing systems become difficult to justify because their feature
            boundaries are unclear. In contrast, this report and the software itself were developed around recognisable
            service groups such as browsing, booking, learning, discussion, support and management. This makes it easier
            to evaluate whether each part of the system contributes directly to the portal's stated purpose.
            """
        ),
        para(
            """
            The introduction also frames the project as an exercise in applied integration. None of the individual
            features in isolation is especially unusual on the modern web. What makes the project substantial is the
            effort to connect them into a coherent user experience with shared identity, persistent data and role-aware
            behaviour. The report therefore pays particular attention to how design and implementation decisions affected
            integration quality across the whole platform.
            """
        ),
    ]
)

SECTION_CONTENT["Background to the project"].extend(
    [
        para(
            """
            The project context also includes the practical reality that many student organisations have limited technical
            resources. A useful club platform cannot assume dedicated internal developers, complicated infrastructure or
            a large operations team. This shaped the decision to build on managed services and a browser-friendly
            multi-page structure. The technical solution therefore had to be sophisticated enough to support realistic
            workflows, but simple enough to remain maintainable by a small team or future student developers.
            """
        ),
        para(
            """
            During development it also became clear that users do not experience the platform as separate technical
            modules. They see one service. If one page shows the wrong club image, a booking record fails to persist or
            a detail page contains a broken map, the perceived quality of the entire platform falls. This insight
            strengthened the emphasis on consistency work, fallback behaviour and deployment checking in later
            iterations of the project.
            """
        ),
    ]
)

SECTION_CONTENT["Aims and objectives"].extend(
    [
        para(
            """
            To make those objectives actionable, they were interpreted in operational terms. For example, "support club
            booking" meant more than displaying time slots: it meant allowing a user to select a slot, complete the
            current booking confirmation flow, see the result in the user dashboard and observe that the record still
            exists after refresh. Likewise, "support community interaction" meant not only creating a forum page, but
            also enabling user identity, posting, media handling, replies and role-aware follow-up behaviour.
            """
        ),
        para(
            """
            Another objective was to improve the professionalism of the overall platform presentation. This covered
            consistent alignment of card layouts, stronger navigation cues, clearer account entry points, more accurate
            maps, standardised cover images and reduced reliance on native browser alert boxes. While these details may
            appear secondary to functionality, they were treated as part of the project's quality objectives because they
            strongly affect user trust in a service platform.
            """
        ),
    ]
)

SECTION_CONTENT["Research question"].extend(
    [
        para(
            """
            Supporting sub-questions emerged naturally from the main research question. These included whether a
            multi-page architecture could remain coherent as features increased, whether a backend-as-a-service approach
            could provide enough persistence and identity management for an academic prototype, and whether iterative
            usability improvements could materially improve the perceived integrity of the platform without a complete
            rewrite.
            """
        ),
        para(
            """
            The project does not attempt to answer these questions through large-scale quantitative user experiments.
            Instead, it answers them through a combination of requirements satisfaction, scenario-based testing,
            deployment evidence and critical evaluation of the finished artefact. In this sense, the research output is a
            combination of the implemented platform and the engineering knowledge gained while integrating its components.
            """
        ),
    ]
)

SECTION_CONTENT["Literature review"].extend(
    [
        para(
            """
            Usability research is especially relevant because the portal targets users with different levels of technical
            confidence. Krug (2014) argues that digital products should make obvious actions feel effortless and should
            avoid forcing users to pause and interpret unnecessarily complicated interfaces. This idea influenced several
            design choices in the project, including direct sign-up navigation, clearer button destinations, more
            consistent back buttons and the removal of unnecessary or confusing interface elements.
            """
        ),
        para(
            """
            The relationship between usability and trust is also significant. Garrett (2011) describes user experience
            as emerging from the interaction of structure, scope and surface. This is useful for understanding the
            project because many usability issues were not caused by isolated styling problems, but by mismatches between
            intended page structure and actual task flow. For instance, if category shortcuts do not align with preview
            filters or if detail pages do not connect smoothly back to booking and profile views, the resulting
            experience becomes fragmented even when each page looks acceptable in isolation.
            """
        ),
        para(
            """
            Role-based interaction is another important strand of relevant literature. Sandhu et al. (1996) formalise
            role-based access control as a way of assigning permissions based on organisational responsibility rather
            than on one-off user exceptions. While this project does not implement a full enterprise RBAC system, the
            same principle is visible in the distinction between members, club managers and administrators. This role
            structure helps the portal remain understandable and reduces the likelihood that ordinary users encounter
            operational interfaces they should not control.
            """
        ),
        para(
            """
            Quality models also shaped the report's evaluation framework. ISO/IEC 25010 presents software quality as a
            combination of characteristics such as functional suitability, performance efficiency, reliability, security,
            maintainability and usability. This model is useful because it avoids reducing project quality to visual
            appeal or feature count alone. In this report, the evaluation therefore considers whether the platform works
            correctly, persists important records, presents consistent interactions and remains maintainable as the
            feature set expands.
            """
        ),
        para(
            """
            Literature on online communities suggests that participation depends not only on content volume but on the
            perceived safety and responsiveness of the environment. A forum with media posting, comments and replies can
            support identity and community retention, but it also requires moderation awareness and a clear sense of
            ownership. The project reflects this by linking forum identity to platform profiles and by maintaining a
            distinction between ordinary community activity and administrative supervision.
            """
        ),
        para(
            """
            Another relevant theme is the engineering trade-off between custom development and platform services.
            Pressman and Maxim (2020) discuss software engineering as a discipline of informed design choice rather than
            writing every component from scratch. In that spirit, the project deliberately chose Supabase for
            authentication, database persistence and storage, and Vercel for deployment, so that effort could be focused
            on workflow integration, data modelling and user-facing behaviour instead of recreating standard cloud
            infrastructure poorly.
            """
        ),
        para(
            """
            Accessibility and inclusive design are also increasingly recognised as central rather than optional. Although
            the project does not yet claim formal accessibility compliance, the literature on accessible web services
            reinforces the need for consistent navigation, readable contrast, clear status messaging and interfaces that
            do not depend entirely on hidden gestures or ambiguous icons. These considerations informed several layout
            simplifications and the addition of stronger navigational cues in later iterations.
            """
        ),
        para(
            """
            Finally, software deployment literature reminds us that system quality is partly operational. A feature that
            works locally but fails after deployment is not functionally complete from the user's perspective. This is
            especially true when external providers such as Supabase, Google OAuth and Vercel are involved. The project's
            online QA process can therefore be understood as part of the system design itself, not merely a final
            checking activity performed after the interesting work has finished.
            """
        ),
    ]
)

SECTION_CONTENT["Requirements"].extend(
    [
        para(
            """
            Requirement gathering was iterative. Some requirements were obvious at the beginning, such as the need for
            club browsing and booking, but others only became explicit after the system was exercised across multiple
            pages. For example, the requirement that the same club image should appear consistently across preview,
            course and detail pages emerged from repeated integration work rather than from an initial specification
            statement. This illustrates how practical development can surface hidden requirements about coherence.
            """
        ),
        para(
            """
            The requirements were also influenced by the desire to produce a system suitable for demonstration and
            academic defence. This encouraged features that reveal system breadth and integration quality, such as the
            presence of both user-facing and management-facing pages, persistent records in dashboards and a visible data
            model behind the interface. The system therefore had to satisfy not only end-user tasks but also the need to
            justify its architecture and implementation decisions clearly.
            """
        ),
    ]
)

SECTION_CONTENT["Product requirements"].extend(
    [
        para(
            """
            A further product requirement was that the platform should guide users between related tasks without forcing
            them to restart their journey from the home page. A student should be able to move naturally from a featured
            club or category card to a club preview, from preview to detail, from detail to booking or join actions, and
            from completed activity to the personal dashboard. This continuity requirement was central to the way routes,
            buttons and shared headers were later refined.
            """
        ),
        para(
            """
            The product also needed to present the impression of a real service rather than an isolated academic mock-up.
            This meant including details such as support messaging, user message history, club manager operations, admin
            views, Google sign-in, profile media and simulated payment confirmation. Even where a feature remained
            simplified, such as payment, the surrounding workflow still needed to feel realistic and coherent.
            """
        ),
    ]
)

SECTION_CONTENT["Interfaces"].extend(
    [
        para(
            """
            The interface design requirement was not only that pages should be individually readable, but that they
            should form a recognisable family. This resulted in repeated use of rounded cards, strong blue hierarchy,
            consistent button structures and predictable top-level navigation. Where pages serve a specialist function,
            such as the club manager dashboard or the admin page, the visual language still needed to remain recognisably
            part of the same platform.
            """
        ),
        para(
            """
            Interface requirements also included support for both desktop and mobile-friendly behaviour. Several later
            adjustments focused on alignment, spacing and the positioning of key controls such as booking actions, course
            times and information panels, because visual disorder in dense card-based layouts can quickly undermine task
            completion even if the underlying functionality is correct.
            """
        ),
    ]
)

SECTION_CONTENT["Functional Capabilities"].extend(
    [
        para(
            """
            The booking capability required a complete operational path. Clubs needed structured slots, users needed a
            way to choose among them, the system needed to compute and display booking states, and the resulting booking
            needed to appear later in a personal record view. This capability was therefore not treated as a single page,
            but as a chain of linked interactions supported by the underlying schema and page services.
            """
        ),
        para(
            """
            Course capabilities were similar but not identical. Courses required rich descriptive content, schedule
            information, favourites support and a different style of detail page than club sessions. This justified a
            distinct course area rather than folding courses into ordinary club bookings. It also provided an additional
            user journey that could demonstrate the flexibility of the underlying platform.
            """
        ),
        para(
            """
            Management capabilities included the creation and maintenance of clubs, course publication, member handling
            and activity review. These capabilities are important because they distinguish the platform from a passive
            information website. A real portal must enable the people behind the clubs to maintain data quality, not just
            ask users to consume whatever static information happened to be published at launch.
            """
        ),
    ]
)

SECTION_CONTENT["Performance Levels"].append(
    para(
        """
        Performance was also interpreted in terms of interaction smoothness. Even where absolute loading times are not
        formally benchmarked, users quickly notice friction if a booking action appears ambiguous, a favourite state
        updates slowly or a dashboard reload hides recent activity. The practical requirement was therefore for key
        interaction states to feel immediate and trustworthy during normal browser use.
        """
    )
)

SECTION_CONTENT["Data Structures/Elements"].extend(
    [
        para(
            """
            The project also required fallback and migration thinking. Because the portal evolved from local demo data
            towards cloud-backed persistence, some parts of the system needed local default datasets and mapping logic so
            that pages remained populated even while cloud records were incomplete. This transitional requirement had an
            important effect on implementation because local and remote representations of the same entity had to be kept
            consistent enough for users not to notice destructive differences.
            """
        ),
        para(
            """
            Data structures were designed to preserve audit value where possible. Booking timestamps, booking status
            transitions, support thread states and login events all contribute to the system's ability to show not merely
            what exists now, but how user activity changes over time. This is useful both for operational monitoring and
            for future extension into analytics or administrative reporting.
            """
        ),
    ]
)

SECTION_CONTENT["Safety"].append(
    para(
        """
        Safety also has a reputational dimension in this kind of platform. If a map is inaccurate, a venue label is
        misleading or an event appears available when it is not, the user may arrive at the wrong location or rely on
        information that is effectively unsafe in practice. The project therefore treated accurate labels, fallback
        logic and clear interface messaging as part of digital safety rather than merely data cleanliness.
        """
    )
)

SECTION_CONTENT["Reliability"].append(
    para(
        """
        Reliability requirements additionally covered role-based continuity. A manager should be able to return to the
        club dashboard and still see the content they created, just as an ordinary user should still see their bookings,
        favourites and forum activity. This expectation of continuity strongly shaped the later migration away from
        local-only UI state toward cloud persistence.
        """
    )
)

SECTION_CONTENT["Security/Privacy"].extend(
    [
        para(
            """
            Privacy concerns are not limited to account credentials. Forum posts, support requests, profile photos and
            venue attendance history can all reveal behaviour patterns. This is why it is important that the system
            distinguishes public club information from personal records and support content. The project does not claim
            to solve every privacy issue, but it recognises that a social and booking platform must separate these
            domains carefully if it is to remain trustworthy.
            """
        ),
        para(
            """
            Integrating Google OAuth also strengthened the project's security narrative because it moved part of the sign
            in experience into a mature external identity system. At the same time, it introduced configuration risk and
            third-party branding considerations, which is a useful reminder that security and user experience are often
            intertwined in practice rather than existing as independent concerns.
            """
        ),
    ]
)

SECTION_CONTENT["Quality"].append(
    para(
        """
        Maintainability was treated as an important quality dimension. As the number of pages increased, duplicated
        logic became a real risk. The project therefore improved quality not only by changing appearance, but also by
        introducing shared helpers, clearer fallback mappings and more explicit page responsibilities. These changes
        help future maintainers understand where a behaviour belongs and reduce the chance of accidental divergence.
        """
    )
)

SECTION_CONTENT["Constraints and Limitations"].append(
    para(
        """
        Another limitation arises from the academic nature of the project itself. Time was available for many
        refinements, but not for a complete commercial hardening process. Features such as full automated regression
        suites, advanced analytics, accessibility audits, performance instrumentation and mature moderation workflows
        would all require additional development cycles beyond the current submission window.
        """
    )
)

SECTION_CONTENT["Performance requirements"].append(
    para(
        """
        Because the portal uses hosted services, performance requirements are partly dependent on external network and
        provider behaviour. For that reason, the project focused on perceived responsiveness and reliable state
        transitions rather than on low-level benchmark figures alone. From the user's perspective, a quickly confirmed
        action with clear status is often more valuable than raw latency numbers presented without context.
        """
    )
)

SECTION_CONTENT["Design constraints"].append(
    para(
        """
        Design constraints also emerged from the need to preserve template simplicity in the codebase. Rewriting the
        portal as a single modern framework application could have reduced some duplication, but it would also have
        changed the scale and risk profile of the project dramatically. Remaining within the established multi-page
        structure was therefore a conscious constraint intended to keep the project deliverable while still allowing
        meaningful improvement.
        """
    )
)

SECTION_CONTENT["Design"].extend(
    [
        para(
            """
            Design work proceeded at several levels simultaneously. At the highest level, the question was how the
            portal should be decomposed into public pages, account pages and management pages. At a second level, the
            question was how shared services and helper modules should support those pages without forcing every
            interaction into a single monolithic script. At the lowest level, the work concerned card layout, image
            consistency, navigation behaviour and status messaging. All three levels were important to the final result.
            """
        ),
        para(
            """
            The design was also informed by the need for a convincing story during evaluation. A system that has many
            unrelated pages is hard to justify. A system that can be explained as a coherent set of actors, workflows,
            shared data structures and cloud services is easier to defend academically. This influenced the decision to
            represent architecture explicitly and to keep page groups aligned with recognisable business functions.
            """
        ),
    ]
)

SECTION_CONTENT["Software design"].extend(
    [
        para(
            """
            The home page was designed as both a branding surface and a route distributor. It introduces the portal,
            highlights categories and provides entry points into club preview, sign-up and related service areas. This
            matters because a good landing page should reduce uncertainty about what the platform is for before the user
            encounters denser functional pages. It is therefore both a design and an onboarding component.
            """
        ),
        para(
            """
            The club preview design follows a card-based pattern because the domain benefits from comparative browsing.
            Users are often deciding among clubs rather than trying to reach one predetermined destination. Cards
            therefore combine cover image, club name, mode, short description, feature tags and key booking information.
            The challenge here was to ensure that informational depth did not destroy visual consistency, which led to
            repeated refinement of alignment, information-box placement and button positioning.
            """
        ),
        para(
            """
            Club detail pages were designed to bridge marketing-style presentation and operational information. They
            include club identity, highlights, venue context, summary descriptions and booking-related information. The
            addition of shared detail-page helpers and more reliable map handling was a design response to the need for
            these pages to feel authoritative rather than decorative. They must help users decide whether a club is
            relevant and how to proceed next.
            """
        ),
        para(
            """
            The booking centre design emphasises action readiness. Compared with preview pages, the booking view needed
            stronger emphasis on slot availability, location, price state and next-step actions. The booking flow also
            required feedback after completion so that users would understand that a booking had been recorded and would
            know where to inspect it later. The simulated payment page sits within this design as an interaction bridge
            rather than as a full e-commerce subsystem.
            """
        ),
        para(
            """
            Course pages were intentionally separated from ordinary club booking because they represent a different
            value proposition. Courses are more instructional, may involve teachers or coaches, and often require richer
            explanatory detail. The course design therefore uses more descriptive content, coach context, learning
            points, notes and recommendation logic. This helped demonstrate that the portal could support more than one
            style of club-related participation without abandoning its shared visual identity.
            """
        ),
        para(
            """
            The forum and support areas were designed around communication rather than scheduling. Their architecture
            still depends on shared user identity, but they solve different problems. The forum supports horizontal
            community interaction through posts, comments, likes and personal activity visibility, whereas the support
            centre supports vertical communication between users and the platform. Keeping these channels distinct helped
            avoid confusing public discussion with private help-seeking behaviour.
            """
        ),
        para(
            """
            The user centre design is important because it closes the loop on earlier actions. A booking platform feels
            incomplete if users cannot later review what they booked, saved or posted. The user centre therefore acts as
            a memory space for the system, gathering bookings, favourites, support records, message histories and forum
            content under one authenticated interface. This improves user confidence and gives the cloud data model
            visible practical value.
            """
        ),
        para(
            """
            The club management dashboard and admin dashboard were designed to demonstrate role-specific operational
            depth. These pages prove that the portal is not only about user consumption but also about stewardship.
            Club managers need interfaces for club creation, editing, membership and course publication, while
            administrators need a cleaner high-level supervision view. Designing both dashboards also strengthened the
            report by showing that system thinking extended beyond the public front end.
            """
        ),
        para(
            """
            Finally, deployment itself was treated as part of software design. The Vercel routing configuration, the
            map-resolving serverless helper, the Supabase URL configuration and the Google OAuth callback paths all form
            part of the designed system. A deployment architecture that cannot support real navigation and sign-in flows
            is not merely an operational problem; it is a design failure. Recognising this helped integrate cloud
            configuration concerns into the main body of the engineering work.
            """
        ),
    ]
)

SECTION_CONTENT["Experimental design"].extend(
    [
        para(
            """
            The test design aimed to cover both positive and negative paths. Positive paths include successful booking,
            successful course enrolment and successful message submission. Negative or edge paths include checking that
            redirects do not loop unexpectedly, that content remains visible after logout or refresh where appropriate,
            and that deployed pages do not refer to local-only assets. This mix was needed because the platform's main
            risks involved integration failure rather than algorithmic correctness alone.
            """
        ),
        para(
            """
            The choice to use multiple accounts in QA was particularly important. Some interactions, such as liking a
            forum post, replying to a comment or sending a direct message, are difficult to validate properly with only
            one user identity. Distinguishing between ordinary user accounts and a manager account also made it possible
            to test role boundaries rather than merely page availability.
            """
        ),
        para(
            """
            The evaluation approach was therefore closer to realistic acceptance testing than to isolated unit testing.
            While this does not replace automated coverage, it matches the integrated nature of the platform. A portal
            that spans booking, courses, communication and management should ultimately be judged by whether realistic
            user journeys succeed from start to finish.
            """
        ),
    ]
)

SECTION_CONTENT["Implementation and testing"].append(
    para(
        """
        This combined chapter is particularly appropriate for the project because many implementation decisions were made
        in direct response to observed testing outcomes. In practice, testing often revealed hidden design assumptions,
        and fixes frequently involved both code changes and revised understanding of how the portal should behave as a
        coherent service.
        """
    )
)

SECTION_CONTENT["Implementation"].extend(
    [
        para(
            """
            Early implementation focused on establishing the core public pages and their relationships. Once those pages
            existed, attention moved to consistency work: ensuring that category links pointed to the correct filtered
            views, that detail pages matched preview cards, and that newly added clubs appeared wherever users would
            reasonably expect to find them. This stage established the baseline information architecture of the platform.
            """
        ),
        para(
            """
            A substantial phase of implementation involved normalising content and imagery. Because different clubs were
            added over time, the same entity could appear with inconsistent covers or incomplete local/cloud mappings.
            Resolving this required updates not only to visible page data but also to fallback logic in shared service
            scripts. This work improved both presentation and maintainability because it reduced the number of silent
            exceptions that future changes would need to remember.
            """
        ),
        para(
            """
            Another important implementation theme was the reduction of local-versus-online divergence. Absolute local
            file paths were replaced with project-relative assets, map handling was adjusted so that local and deployed
            behaviour matched more closely, and fallback logic was introduced where cloud data might be incomplete. This
            kind of work does not always appear in polished system overviews, but it was essential to producing a portal
            that behaved credibly outside the developer's own machine.
            """
        ),
        para(
            """
            Booking implementation required careful sequencing. Clubs needed structured metadata, booking cards needed
            actionable states, the payment page needed to accept a simulated success model, and the resulting records
            needed to persist back into the user centre and dashboard views. Adding new clubs to the booking system also
            highlighted the importance of making sure that local fallback datasets and cloud-aware behaviour remained in
            sync rather than splitting into separate realities.
            """
        ),
        para(
            """
            Course implementation followed a parallel but distinct path. Course list pages, detail pages and the user's
            favourites or bookings all needed to reference the same course entities while still preserving a more
            instructional presentation style than ordinary club sessions. Improvements such as aligning course time
            labels and making recommendation logic category-aware helped refine this part of the platform beyond a basic
            list of static course cards.
            """
        ),
        para(
            """
            Community features were implemented with a combination of stored forum data, user identity and interface
            refinements. Features such as following, custom groups, post interaction and message history are valuable
            because they make the platform feel more social and persistent. At the same time, these features required
            extra care in order to keep menus understandable and stateful across refreshes.
            """
        ),
        para(
            """
            Shared UI polish became an implementation stream in its own right. Native browser alerts were replaced with
            in-page modal dialogs to keep the platform visually consistent. Back buttons were added to detail pages,
            information panels were aligned within cards, unnecessary labels were removed where they created clutter, and
            sign-up navigation was made more direct. These refinements represent implementation work aimed at reducing
            hesitation and improving perceived quality rather than adding entirely new features.
            """
        ),
        para(
            """
            Authentication implementation evolved substantially. The project first simplified local email verification
            behaviour, then aligned the front-end flow with Supabase configuration changes, and finally integrated Google
            sign-in through Supabase OAuth and Google Cloud settings. This sequence illustrates how identity work often
            involves both interface and operations tasks. The code needed appropriate buttons and callback handling, but
            the complete solution also depended on provider configuration, redirect URLs and branding considerations.
            """
        ),
    ]
)

SECTION_CONTENT["Testing"].extend(
    [
        para(
            """
            Syntax validation was used as a lightweight but useful safeguard during development. Where shared JavaScript
            files or large in-page scripts were edited, syntax checking helped catch structural errors before those
            errors became visible through broken pages. This was particularly valuable because several of the important
            pages contain substantial embedded logic and multiple interaction paths.
            """
        ),
        para(
            """
            Functional testing was then performed on complete user journeys. In the booking workflow, for example, the
            important question was not just whether slot cards rendered correctly, but whether a user could choose a
            slot, complete the simulated payment stage, review the booking in the user centre and then observe
            persistence after refresh. This kind of end-to-end thinking was applied across the other major feature areas as well.
            """
        ),
        para(
            """
            Testing of the course subsystem focused on both transactional and preference-oriented behaviours. It was
            necessary to confirm that users could book courses, but also that they could save and later remove favourites
            in a way that remained visible after page reload. This supported the broader project aim of making the user
            centre feel like a reliable record of platform activity rather than a temporary view of front-end state.
            """
        ),
        para(
            """
            Forum testing required especially careful scenario design because many of its interactions are relational.
            One user needs to create a post, another user needs to like or comment, and then the first user may reply or
            inspect profile-related content. This makes the forum a strong test bed for cross-user persistence, storage
            behaviour and the integrity of profile-linked media.
            """
        ),
        para(
            """
            Dashboard testing focused on persistence and role correctness. A manager needed to create or edit a club,
            publish or modify a course and review activity states, then confirm that the same information was still
            present after refresh. This type of testing helps separate a purely decorative dashboard from one that
            genuinely interacts with cloud-backed operational records.
            """
        ),
        para(
            """
            The most important result of testing was not the discovery of one dramatic bug, but the accumulation of many
            smaller corrections. Misaligned buttons, duplicate club entries, inaccurate local maps, missing club images,
            inconsistent category options and confusing alert boxes all became visible through repeated use. Addressing
            these issues significantly improved the overall system even though each one might appear modest in isolation.
            """
        ),
    ]
)

SECTION_CONTENT["External concerns"].append(
    para(
        """
        The project also raises questions about platform dependence. Using managed services accelerates delivery and
        simplifies some security responsibilities, but it also ties the system to the operational behaviour and branding
        of those services. This creates a strategic trade-off between speed of development and long-term control that any
        future production version would need to evaluate carefully.
        """
    )
)

SECTION_CONTENT["Legal, social and ethical issues"].extend(
    [
        para(
            """
            Content moderation is an especially important ethical concern because the portal includes both public and
            semi-private communication features. Even a relatively small campus-focused community can encounter harmful
            posts, inappropriate media or misuse of messaging tools. The presence of an admin view and support routes is
            therefore not only operationally useful but ethically relevant, as it recognises that digital communities
            require stewardship.
            """
        ),
        para(
            """
            Data retention is another issue. A production system would need clear rules about how long booking records,
            support requests, uploaded media and login events should be retained, and who is permitted to access them.
            The current project establishes the technical possibility of storing such records, but a real deployment would
            need formal policy decisions and explicit communication to users to ensure lawful and ethical handling.
            """
        ),
        para(
            """
            There is also an ethical dimension to representation and inclusion. Clubs vary in type, formality, location
            and mode of participation. A fair platform should allow non-sport, hybrid and community-focused groups to
            appear alongside traditional clubs without being structurally disadvantaged by assumptions built into the
            interface. This influenced decisions around categories, cards, course presentation and support for both
            physical and online location descriptions.
            """
        ),
    ]
)

SECTION_CONTENT["Commercial issues and exploitation"].extend(
    [
        para(
            """
            A commercially exploited version of the system could be positioned as a modular campus engagement platform.
            Different institutions might enable or disable community tools, course features, analytics or payment
            components according to their needs. This suggests that the project's architectural separation of concerns has
            value beyond the immediate academic submission, because modularity is an advantage when considering
            configurable product offerings.
            """
        ),
        para(
            """
            Commercialisation would, however, require stronger non-functional guarantees. Institutions purchasing a
            service of this kind would expect defined support processes, service-level considerations, accessibility
            assurance, migration strategies and a clearer compliance story. The current project should therefore be seen
            as commercially suggestive rather than commercially complete, which is still a valuable outcome for an academic prototype.
            """
        ),
    ]
)

SECTION_CONTENT["Evaluation and discussion of results"].extend(
    [
        para(
            """
            In evaluating the portal against its original aims, the strongest evidence of success lies in the number of
            workflows that now cross page boundaries without collapsing into inconsistency. Club discovery leads into
            detail viewing and booking, course exploration leads into favourites and personal records, and forum activity
            leads into profile-linked content and messaging. These workflows demonstrate that the project is more than a
            collection of individually styled pages.
            """
        ),
        para(
            """
            The project also performs well as a demonstration of practical full-stack thinking despite its front-end
            emphasis. The cloud schema is not incidental; it directly shapes what the user sees. Similarly, deployment is
            not merely a hosting step; it determines whether redirects, map links, login flows and media references work
            in realistic conditions. This close relationship between interface behaviour and infrastructure choice is one
            of the project's most valuable engineering lessons.
            """
        ),
        para(
            """
            A further strength is adaptability. The system has accommodated repeated content additions, cover-image
            changes, UI refinements, category adjustments and authentication changes without requiring total
            reconstruction. This suggests that the design has at least moderate resilience, even if it would benefit from
            more formal refactoring in a future production cycle.
            """
        ),
        para(
            """
            On the other hand, some limitations remain significant. The project still depends heavily on manual checking
            after deployments, and some behaviours are protected more by careful iterative refinement than by formal
            automated tests. This creates a maintenance risk as the codebase grows. In addition, certain design elements
            remain somewhat page-specific, which means future developers would still need to work carefully to avoid drift.
            """
        ),
        para(
            """
            The payment flow is another clear limitation. Although it successfully demonstrates how the user is guided
            from booking selection into confirmation and dashboard review, it does not yet handle real payment providers,
            transaction verification, refunds or payment failure states with the depth expected from a production
            commerce system. This is acceptable for a prototype, but it should be acknowledged explicitly in evaluation.
            """
        ),
        para(
            """
            Even with these limitations, the project succeeds as an applied systems integration exercise. It transforms
            a potentially scattered set of club-oriented features into a platform with visible structure, persistent
            records and multiple stakeholder views. That makes it a stronger academic artefact than a one-page demo or a
            purely conceptual design because it can be evaluated through direct interaction and repeated testing.
            """
        ),
    ]
)

SECTION_CONTENT["Programme specific concerns"].extend(
    [
        para(
            """
            The project also demonstrates competence in web architecture and data-aware software design. It required
            decisions about when to keep logic at page level, when to move it into shared scripts, how to structure a
            schema that supports multiple domains and how to connect cloud services to front-end experiences without
            exposing users to technical complexity. These are central concerns within Computer Science and applied
            software engineering programmes.
            """
        ),
        para(
            """
            Another programme-specific strength is the integration of development practice with reflective evaluation.
            The report is not simply a celebration of features. It considers why certain trade-offs were made, where the
            design remains limited, how deployment influenced outcomes and which future improvements would create the most
            value. This ability to evaluate an implemented system critically is an important disciplinary competency.
            """
        ),
    ]
)

SECTION_CONTENT["Conclusion"].append(
    para(
        """
        The conclusion of the project is therefore not that every possible portal feature has been implemented, but that
        a clear, credible and extensible foundation has been created. The software now demonstrates what a joined-up
        club platform can look like when discovery, participation, communication and administration are treated as parts
        of one system rather than as unrelated digital fragments.
        """
    )
)

SECTION_CONTENT["Project management"].extend(
    [
        para(
            """
            In retrospect, the iterative approach was appropriate because much of the most valuable work was corrective
            and connective rather than purely additive. A rigid plan focused only on adding new pages would likely have
            produced a larger but weaker system. By repeatedly returning to alignment, navigation, persistence and
            deployment quality, the project improved its internal coherence, which is a more important achievement for a
            service platform than simple feature count.
            """
        ),
        para(
            """
            Time management lessons also emerged. Small, well-defined improvements often delivered disproportionate
            value because they resolved user confusion in high-traffic areas. Examples include direct navigation to the
            sign-up form, removing redundant labels, fixing duplicated club entries, aligning buttons and ensuring that
            key images remained consistent. This suggests that future planning should reserve time not only for large
            milestones but also for the many refinements that make an integrated system feel finished.
            """
        ),
    ]
)

SECTION_CONTENT["Risk management"].extend(
    [
        para(
            """
            Some of the most important risks were not purely technical bugs but integration mismatches. A local map link
            that differs from the deployed link, a booking item that exists in one dataset but not another, or an OAuth
            callback path that is correct in one environment and incorrect in another can all make the platform appear
            unreliable. These risks required repeated cross-environment validation rather than one-time code inspection.
            """
        ),
        para(
            """
            Another lesson was that scope risk can be reduced by accepting staged completeness. The project is stronger
            because it contains an honest simulated payment flow than it would have been if an unstable or misleading
            pseudo-payment implementation had been presented as complete. Future risk management should continue this
            principle by making staged limitations explicit rather than allowing hidden fragility to accumulate.
            """
        ),
    ]
)

SECTION_CONTENT["General conclusions"].extend(
    [
        para(
            """
            The project contributes most strongly in showing how incremental refinement can turn a feature-rich but
            potentially fragmented concept into a more coherent service. Improvements to navigation, data persistence,
            shared helpers, image consistency, map accuracy, dashboards and sign-in flows all made the platform more
            trustworthy without changing its overall identity. This is an important practical lesson for software
            engineering projects that grow over time.
            """
        ),
        para(
            """
            If taken forward, the most valuable next steps would likely be the introduction of automated regression
            testing, stronger accessibility review, more formal moderation tools, a genuine payment provider and richer
            institutional reporting. These improvements would not replace the current architecture; they would build on a
            foundation that already demonstrates clear domain structure and realistic user journeys.
            """
        ),
        para(
            """
            In summary, Club Enrolment Portal shows that a university club platform can be meaningfully improved by
            integrating content, identity, bookings, courses, discussion and management into one environment. The system
            remains a prototype, but it is a mature prototype with enough depth to support serious reflection on design,
            implementation, deployment and future exploitation.
            """
        ),
    ]
)

SECTION_CONTENT["References"].extend(
    [
        "Garrett, J.J. (2011) The Elements of User Experience: User-Centered Design for the Web and Beyond. 2nd edn. Berkeley, CA: New Riders.",
        "ISO/IEC (2011) ISO/IEC 25010:2011 Systems and software engineering - Systems and software Quality Requirements and Evaluation (SQuaRE) - System and software quality models. Geneva: International Organization for Standardization.",
        "Krug, S. (2014) Don't Make Me Think, Revisited: A Common Sense Approach to Web Usability. 3rd edn. Berkeley, CA: New Riders.",
        "Pressman, R.S. and Maxim, B.R. (2020) Software Engineering: A Practitioner's Approach. 9th edn. New York: McGraw-Hill.",
        "Sandhu, R.S., Coyne, E.J., Feinstein, H.L. and Youman, C.E. (1996) 'Role-Based Access Control Models', Computer, 29(2), pp. 38-47.",
    ]
)

SECTION_CONTENT["Literature review"].extend(
    [
        para(
            """
            There is also relevant literature on the importance of data-informed design in service platforms. Systems
            that record only the final state of an interaction often struggle to support auditing, moderation or
            meaningful feedback. By contrast, systems that maintain traceable records of bookings, favourites, messages
            and support threads can offer a richer sense of accountability and continuity. This influenced the project's
            decision to treat user actions as persistent data events rather than as one-time front-end transformations.
            """
        ),
        para(
            """
            The literature also suggests that integrated educational and student services benefit from reducing
            unnecessary channel switching. If a user has to move repeatedly between unrelated systems for discovery,
            joining, payment, communication and follow-up, abandonment becomes more likely. The project's unified portal
            model responds directly to this issue by attempting to keep club-related activity within one connected
            environment, even when the underlying features serve different purposes.
            """
        ),
    ]
)

SECTION_CONTENT["Software design"].extend(
    [
        para(
            """
            The design of shared scripts was particularly important to avoiding architectural drift. For example,
            booking behaviour, course behaviour and forum behaviour each required their own logic, yet all of them
            depended on a common account context and cloud client. By separating domain-specific service scripts from
            page templates, the project could continue using a multi-page structure while still moving towards a more
            modular and understandable codebase.
            """
        ),
        para(
            """
            Another design consideration was fallback behaviour during migration from local demo data to cloud records.
            Rather than simply removing local content and risking empty screens, the system used fallback mappings and
            local defaults in selected areas. This design choice supported continuity during development, but it also
            required careful governance so that fallback logic did not silently contradict cloud truth. The eventual
            design therefore aimed for controlled fallback rather than uncontrolled duplication.
            """
        ),
    ]
)

SECTION_CONTENT["Implementation"].extend(
    [
        para(
            """
            The implementation process also benefited from treating many apparently small changes as legitimate software
            engineering tasks. Adjustments such as moving information panels to consistent positions, ensuring that
            recommendation sections responded to category context, or removing duplicate or misleading UI labels all had
            direct effects on user comprehension. In an integrated platform, small improvements often create cumulative
            value by reducing repeated confusion across many sessions.
            """
        ),
        para(
            """
            Versioning and deployment practice further shaped implementation. Changes were frequently validated in the
            local workspace, then committed and pushed to the main deployment branch so that production behaviour could be
            checked in context. This iterative release habit is important because it exposes configuration-sensitive
            issues early, especially where authentication providers, route redirects or hosted media are involved.
            """
        ),
    ]
)

SECTION_CONTENT["Testing"].extend(
    [
        para(
            """
            Another important aspect of testing was comparative checking between local and deployed environments. A page
            can appear correct in local development while still failing online because of absolute paths, missing assets,
            callback settings or environment-dependent logic. By treating deployment verification as part of normal QA,
            the project reduced the risk that the final artefact would be convincing only on the developer's machine.
            """
        ),
        para(
            """
            The testing evidence also supports the argument that integration quality improved over time. Later iterations
            of the system showed stronger consistency in club imagery, category filtering, map behaviour, booking
            persistence and sign-up navigation. These are meaningful outcomes because they indicate that the project was
            not merely accumulating new features, but actively reducing cross-page friction and operational ambiguity.
            """
        ),
    ]
)

SECTION_CONTENT["Evaluation and discussion of results"].extend(
    [
        para(
            """
            Evaluation against non-functional goals is also positive overall. The platform is visually more coherent than
            an ad hoc multi-page student prototype, role distinctions are understandable, data persistence covers the
            major user journeys and deployment has been treated seriously enough for the online version to matter as an
            evaluation environment. This does not eliminate all technical debt, but it does show credible engineering discipline.
            """
        ),
        para(
            """
            The project is perhaps most convincing where it connects user-facing refinement to deeper system structure.
            For example, a cleaner card layout is more valuable because the underlying booking or course records persist;
            a more accurate map is more valuable because it sits within a detail page that also supports action; and a
            Google sign-in button is more valuable because it connects to a genuine cloud session rather than a cosmetic
            front-end simulation. This interaction between surface and structure strengthens the quality of the artefact.
            """
        ),
    ]
)

SECTION_CONTENT["Project management"].append(
    para(
        """
        The management process therefore demonstrates the importance of feedback-responsive planning. Rather than treating
        the original project plan as fixed, development continued to reinterpret priorities in response to what the
        system revealed during testing and demonstration. This made the process more adaptive and arguably more aligned
        with the realities of applied software engineering than a static one-direction plan would have been.
        """
    )
)

SECTION_CONTENT["General conclusions"].extend(
    [
        para(
            """
            The report also shows that a strong final-year project does not have to depend on a single technically novel
            algorithm. Substantial value can come from integrating multiple practical concerns - data, identity,
            interface, deployment, moderation and management - into one artefact that can be explored, critiqued and
            improved. This kind of integration work is often closer to real software engineering practice than isolated
            theoretical novelty.
            """
        ),
        para(
            """
            For that reason, the contribution of the project should be judged not only by what it currently includes,
            but by what it now makes possible. The platform provides a basis for further institutionalisation, testing,
            analytics, accessibility work, governance and real transactional extensions. In other words, it is not an
            endpoint but a credible starting point for a fuller platform lifecycle.
            """
        ),
    ]
)

SECTION_CONTENT["Appendix B – Manual QA checklist summary"].append(
    para(
        """
        In a final submission context, this appendix is useful because it documents the practical logic behind the test
        strategy. It shows that the platform was exercised through concrete and repeatable scenarios, not only through
        informal clicking. For a system whose value lies in connected workflows, that kind of scenario record is an
        important part of the evidence base for evaluation.
        """
    )
)

SECTION_CONTENT["Design"].append(
    para(
        """
        A final design observation is that coherence required active maintenance rather than emerging automatically from
        shared colours or repeated card shapes. The portal only began to feel structurally unified when navigation
        behaviour, cover imagery, information hierarchy, route destinations and state persistence were treated as parts
        of one design conversation. This reinforces the report's overall argument that integration quality is a designed
        property, not an accidental side effect of feature growth.
        """
    )
)

SECTION_CONTENT["Implementation"].append(
    para(
        """
        The implementation process also demonstrates the value of keeping the project grounded in real pages rather than
        abstract architectural ambition. Because every improvement had to appear somewhere visible in the running system,
        technical decisions were repeatedly tested against user-facing outcomes. This helped ensure that refactoring,
        configuration work and shared helper logic all remained tied to practical value instead of becoming detached
        engineering activity with no obvious benefit to the finished portal.
        """
    )
)

SECTION_CONTENT["Testing"].append(
    para(
        """
        Taken together, the testing activities provide a reasonable level of confidence for an academic prototype. They
        do not yet replace the assurance that would come from a mature automated test suite and long-term monitoring, but
        they do show that the major role-based workflows have been intentionally exercised and corrected. This is a
        meaningful result for a multi-feature system developed within a limited project timeframe.
        """
    )
)

SECTION_CONTENT["Evaluation and discussion of results"].append(
    para(
        """
        Another useful evaluative lens is the project's ability to support explanation. A successful final-year project
        should not only work, but also be understandable when presented to an assessor. The current artefact performs
        well here because its main functions map cleanly to visible pages, shared services and a documented schema. That
        clarity makes the engineering choices easier to justify and strengthens the overall academic value of the work.
        """
    )
)

SECTION_CONTENT["General conclusions"].append(
    para(
        """
        Reaching this stage also suggests that future effort should be prioritised selectively rather than by feature
        accumulation alone. The most valuable enhancements are likely to be those that deepen trust in the existing
        platform: stronger automated regression checks, clearer operational policies, improved accessibility and a more
        complete payment or analytics layer. These would strengthen the system precisely because they build on an already
        coherent foundation.
        """
    )
)

SECTION_CONTENT["Appendix A – Repository structure and key files"].append(
    para(
        """
        From a report-writing perspective, this repository structure is also advantageous because it mirrors the logical
        decomposition of the platform. A reader can move from page entry points to shared scripts to cloud schema and
        deployment configuration with relatively little ambiguity. That transparency helps connect the written report to
        the actual software artefact, which is important for both technical review and academic assessment.
        """
    )
)

SECTION_CONTENT["Implementation"].append(
    para(
        """
        One of the clearest lessons from implementation was that integration features often depend on careful naming and
        mapping discipline. Club slugs, cover images, category labels and page links all had to remain coordinated across
        preview pages, booking pages, detail pages, dashboards and fallback datasets. This required repeated tidying work,
        but it also improved the conceptual integrity of the platform by ensuring that the same club remained recognisably
        the same object wherever the user encountered it.
        """
    )
)

SECTION_CONTENT["Evaluation and discussion of results"].append(
    para(
        """
        It is also worth noting that the project became stronger as a communication artefact over time. Architecture
        diagrams, clearer repository documentation, richer appendices and a more explicit connection between pages,
        scripts and schema all make the system easier to understand as an engineered whole. This matters because software
        quality in an academic context includes the ability to explain, justify and evaluate the artefact, not only to
        run it successfully in a browser.
        """
    )
)

SECTION_CONTENT["General conclusions"].append(
    para(
        """
        For these reasons, the project can be regarded as a successful demonstration of applied software engineering in a
        realistic service domain. It integrates interface design, data modelling, cloud services, deployment practice and
        iterative evaluation into one substantial artefact. The result is not merely a polished front end, but a platform
        with enough functional depth and reflective support to justify continued development and serious academic analysis.
        """
    )
)


FIGURE_SPECS = [
    {
        "key": "use_case",
        "filename": "report_use_case.jpg",
        "heading": "Product requirements",
        "caption": "Figure 1. Main user roles and core portal use cases.",
        "width_in": 6.6,
        "height_in": 4.2,
    },
    {
        "key": "data_model",
        "filename": "report_data_model.jpg",
        "heading": "Data Structures/Elements",
        "caption": "Figure 2. Simplified data model for the cloud-backed portal.",
        "width_in": 6.8,
        "height_in": 4.4,
    },
    {
        "key": "architecture",
        "filename": "report_architecture.jpg",
        "heading": "Software design",
        "caption": "Figure 3. High-level software architecture of Club Enrolment Portal.",
        "width_in": 6.8,
        "height_in": 4.6,
    },
]


def p_text(paragraph):
    return "".join(t.text or "" for t in paragraph.findall(".//w:t", NS)).strip()


def load_style_name_map(styles_root):
    style_map = {}
    for style in styles_root.findall("w:style", NS):
        style_id = style.get(f"{W}styleId")
        name = style.find("w:name", NS)
        style_map[style_id] = name.get(f"{W}val") if name is not None else style_id
    return style_map


def paragraph_style_name(paragraph, style_map):
    style = paragraph.find("w:pPr/w:pStyle", NS)
    if style is None:
        return "Normal"
    return style_map.get(style.get(f"{W}val"), style.get(f"{W}val"))


def clear_and_set_text(paragraph, text):
    for child in list(paragraph):
        if child.tag != f"{W}pPr":
            paragraph.remove(child)
    run = ET.Element(f"{W}r")
    text_node = ET.SubElement(run, f"{W}t")
    if text.startswith(" ") or text.endswith(" "):
        text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = text
    paragraph.append(run)


def clone_normal_paragraph(normal_template, text):
    paragraph = deepcopy(normal_template)
    clear_and_set_text(paragraph, text)
    return paragraph


def ensure_ppr(paragraph):
    ppr = paragraph.find(f"{W}pPr")
    if ppr is None:
        ppr = ET.Element(f"{W}pPr")
        paragraph.insert(0, ppr)
    return ppr


def set_alignment(paragraph, value):
    ppr = ensure_ppr(paragraph)
    jc = ppr.find(f"{W}jc")
    if jc is None:
        jc = ET.SubElement(ppr, f"{W}jc")
    jc.set(f"{W}val", value)


def clone_centered_paragraph(normal_template, text):
    paragraph = clone_normal_paragraph(normal_template, text)
    set_alignment(paragraph, "center")
    return paragraph


def insert_after(body, anchor, paragraphs):
    children = list(body)
    index = children.index(anchor)
    for offset, paragraph in enumerate(paragraphs, start=1):
        body.insert(index + offset, paragraph)


def find_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                pass
    return ImageFont.load_default()


def wrap_text(draw, text, font, max_width):
    words = text.split()
    if not words:
        return [""]
    lines = []
    current = words[0]
    for word in words[1:]:
        trial = current + " " + word
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_multiline(draw, box, text, font, fill, align="center", spacing=8):
    x1, y1, x2, y2 = box
    lines = wrap_text(draw, text, font, x2 - x1 - 20)
    line_boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    total_height = sum(b[3] - b[1] for b in line_boxes) + spacing * (len(lines) - 1)
    y = y1 + max(12, (y2 - y1 - total_height) / 2)
    for line, bbox in zip(lines, line_boxes):
        width = bbox[2] - bbox[0]
        if align == "left":
            x = x1 + 14
        elif align == "right":
            x = x2 - width - 14
        else:
            x = x1 + (x2 - x1 - width) / 2
        draw.text((x, y), line, font=font, fill=fill)
        y += (bbox[3] - bbox[1]) + spacing


def rounded_box(draw, box, fill, outline, width, title, body=None, title_font=None, body_font=None, title_fill=(28, 50, 88)):
    draw.rounded_rectangle(box, radius=26, fill=fill, outline=outline, width=width)
    x1, y1, x2, y2 = box
    if title:
        title_area = (x1 + 10, y1 + 10, x2 - 10, y1 + 56)
        draw_multiline(draw, title_area, title, title_font or find_font(30, bold=True), title_fill)
    if body:
        body_area = (x1 + 10, y1 + 58, x2 - 10, y2 - 12)
        draw_multiline(draw, body_area, body, body_font or find_font(22), (73, 92, 122))


def draw_arrow(draw, start, end, fill=(71, 103, 165), width=6):
    draw.line([start, end], fill=fill, width=width)
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    arrow_len = 18
    arrow_w = 10
    p1 = (end[0] - ux * arrow_len + px * arrow_w, end[1] - uy * arrow_len + py * arrow_w)
    p2 = (end[0] - ux * arrow_len - px * arrow_w, end[1] - uy * arrow_len - py * arrow_w)
    draw.polygon([end, p1, p2], fill=fill)


def image_to_jpeg_bytes(image):
    output = BytesIO()
    image.save(output, format="JPEG", quality=92)
    return output.getvalue()


def render_use_case_figure():
    image = Image.new("RGB", (1600, 960), (251, 253, 255))
    draw = ImageDraw.Draw(image)
    title_font = find_font(42, bold=True)
    box_title_font = find_font(28, bold=True)
    box_body_font = find_font(20)
    draw.text((60, 38), "Use Case Overview", fill=(24, 42, 76), font=title_font)

    actor_fill = (230, 239, 255)
    actor_outline = (124, 154, 209)
    use_fill = (245, 248, 255)
    use_outline = (165, 184, 223)

    left_boxes = [
        ((70, 180, 360, 340), "Member", "Browse clubs\nBook sessions\nEnrol in courses\nJoin forum\nSend support message"),
        ((70, 405, 360, 595), "Club Manager", "Create or edit club\nManage members\nPublish courses\nReview activities"),
        ((70, 660, 360, 850), "Administrator", "Monitor platform\nReview content\nInspect dashboards\nSupport governance"),
    ]
    center_boxes = [
        ((520, 150, 820, 260), "Authentication", "Register, log in, Google sign-in, profile access"),
        ((900, 150, 1220, 260), "Club Discovery", "Home page, category filters, preview cards, detail pages"),
        ((520, 330, 820, 460), "Booking Workflow", "Select slot, confirm booking, review record in dashboard"),
        ((900, 330, 1220, 460), "Course Workflow", "Open course details, favourite, book scheduled sessions"),
        ((520, 540, 820, 690), "Community and Support", "Forum posts, comments, likes, direct and support messages"),
        ((900, 540, 1220, 690), "Operations", "Club management dashboard and admin supervision views"),
    ]

    for box, title, body in left_boxes:
        rounded_box(draw, box, actor_fill, actor_outline, 4, title, body, box_title_font, box_body_font)
    for box, title, body in center_boxes:
        rounded_box(draw, box, use_fill, use_outline, 4, title, body, box_title_font, box_body_font)

    connections = [
        ((360, 260), (520, 205)),
        ((360, 260), (520, 395)),
        ((360, 260), (520, 615)),
        ((360, 500), (1220, 615)),
        ((360, 500), (1220, 395)),
        ((360, 755), (1220, 615)),
        ((820, 205), (900, 205)),
        ((820, 395), (900, 395)),
        ((820, 615), (900, 615)),
    ]
    for start, end in connections:
        draw_arrow(draw, start, end)

    footer_font = find_font(18)
    draw.text((60, 905), "This diagram summarises the main actor groups and the feature areas they depend on.", fill=(79, 97, 128), font=footer_font)
    return image_to_jpeg_bytes(image)


def render_data_model_figure():
    image = Image.new("RGB", (1600, 1020), (252, 253, 255))
    draw = ImageDraw.Draw(image)
    title_font = find_font(42, bold=True)
    box_title_font = find_font(28, bold=True)
    box_body_font = find_font(20)
    draw.text((60, 36), "Simplified Data Model", fill=(24, 42, 76), font=title_font)

    core_fill = (230, 242, 247)
    core_outline = (103, 157, 171)
    entity_fill = (246, 249, 255)
    entity_outline = (170, 186, 219)

    center = (600, 390, 1010, 610)
    rounded_box(
        draw,
        center,
        core_fill,
        core_outline,
        5,
        "Supabase Cloud Data Layer",
        "Authentication, PostgreSQL records, object storage and role-aware persistence",
        box_title_font,
        box_body_font,
    )

    entity_boxes = [
        ((90, 165, 450, 305), "Profiles", "User identity, nickname, role, avatar and personal metadata"),
        ((90, 385, 450, 545), "Clubs and Slots", "Club information, tags, venues, availability and schedules"),
        ((90, 660, 450, 840), "Forum and Support", "Posts, comments, likes, support threads and support messages"),
        ((1160, 165, 1510, 305), "Club Bookings", "Bookings, payment state, attendance status and timestamps"),
        ((1160, 385, 1510, 565), "Courses", "Course details, schedules, favourites and course bookings"),
        ((1160, 680, 1510, 840), "Dashboards", "Manager and admin views assembled from shared cloud records"),
    ]

    for box, title, body in entity_boxes:
        rounded_box(draw, box, entity_fill, entity_outline, 4, title, body, box_title_font, box_body_font)

    center_points = [
        ((450, 235), (600, 460)),
        ((450, 465), (600, 500)),
        ((450, 750), (600, 540)),
        ((1010, 460), (1160, 235)),
        ((1010, 500), (1160, 475)),
        ((1010, 540), (1160, 760)),
    ]
    for start, end in center_points:
        draw_arrow(draw, start, end, fill=(78, 118, 160), width=6)

    note_font = find_font(18)
    draw.text((60, 955), "Records are linked so that public pages, user dashboards and management tools can read the same source of truth.", fill=(79, 97, 128), font=note_font)
    return image_to_jpeg_bytes(image)


def render_architecture_figure():
    image = Image.new("RGB", (1600, 1040), (251, 252, 255))
    draw = ImageDraw.Draw(image)
    title_font = find_font(42, bold=True)
    box_title_font = find_font(28, bold=True)
    box_body_font = find_font(20)
    draw.text((60, 36), "High-Level Software Architecture", fill=(24, 42, 76), font=title_font)

    user_fill = (238, 244, 255)
    front_fill = (244, 248, 255)
    logic_fill = (235, 244, 242)
    cloud_fill = (246, 242, 251)

    rounded_box(draw, (70, 170, 360, 870), user_fill, (135, 161, 216), 4, "User Roles", "Visitors\nMembers\nClub managers\nAdministrators", box_title_font, find_font(24))
    rounded_box(draw, (470, 110, 850, 300), front_fill, (159, 180, 219), 4, "Public Pages", "Home, club preview, club details, booking, courses, forum and support pages", box_title_font, box_body_font)
    rounded_box(draw, (470, 360, 850, 565), front_fill, (159, 180, 219), 4, "Account and Dashboard Pages", "Join or user centre, messages, club manager dashboard and admin dashboard", box_title_font, box_body_font)
    rounded_box(draw, (470, 640, 850, 885), logic_fill, (123, 174, 163), 4, "Shared Client Logic", "Vue page state, Supabase client, booking and course services, forum services, auth helpers, custom dialogs and map helpers", box_title_font, box_body_font)
    rounded_box(draw, (980, 140, 1510, 350), cloud_fill, (171, 149, 197), 4, "Supabase Services", "Authentication\nPostgreSQL data tables\nStorage buckets\nRole-aware cloud persistence", box_title_font, find_font(22))
    rounded_box(draw, (980, 430, 1510, 620), cloud_fill, (171, 149, 197), 4, "Deployment Layer", "Vercel static hosting\nRoute redirects\nServerless map resolver helper", box_title_font, box_body_font)
    rounded_box(draw, (980, 700, 1510, 900), cloud_fill, (171, 149, 197), 4, "External Providers", "Google OAuth configuration and browser-based access across local and production environments", box_title_font, box_body_font)

    arrows = [
        ((360, 260), (470, 205)),
        ((360, 520), (470, 460)),
        ((360, 760), (470, 760)),
        ((850, 205), (980, 245)),
        ((850, 460), (980, 525)),
        ((850, 760), (980, 800)),
        ((850, 760), (980, 245)),
        ((1510, 525), (1510, 800)),
    ]
    for start, end in arrows:
        draw_arrow(draw, start, end)

    footer_font = find_font(18)
    draw.text((60, 975), "The platform combines multi-page front-end delivery with shared JavaScript services and cloud-backed persistence.", fill=(79, 97, 128), font=footer_font)
    return image_to_jpeg_bytes(image)


def generate_report_figures():
    return {
        "use_case": render_use_case_figure(),
        "data_model": render_data_model_figure(),
        "architecture": render_architecture_figure(),
    }


def add_image_relationship(rels_root, target):
    existing = []
    for rel in rels_root.findall(f"{PR}Relationship"):
        rel_id = rel.get("Id", "")
        if rel_id.startswith("rId") and rel_id[3:].isdigit():
            existing.append(int(rel_id[3:]))
    new_id = f"rId{max(existing or [0]) + 1}"
    rel = ET.SubElement(rels_root, f"{PR}Relationship")
    rel.set("Id", new_id)
    rel.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image")
    rel.set("Target", target)
    return new_id


def make_image_paragraph(image_rid, name, width_in, height_in, docpr_id):
    cx = int(width_in * 914400)
    cy = int(height_in * 914400)
    paragraph = ET.Element(f"{W}p")
    ppr = ET.SubElement(paragraph, f"{W}pPr")
    jc = ET.SubElement(ppr, f"{W}jc")
    jc.set(f"{W}val", "center")
    run = ET.SubElement(paragraph, f"{W}r")
    rpr = ET.SubElement(run, f"{W}rPr")
    ET.SubElement(rpr, f"{W}noProof")
    drawing = ET.SubElement(run, f"{W}drawing")
    inline = ET.SubElement(drawing, f"{WP}inline")
    for attr in ("distT", "distB", "distL", "distR"):
        inline.set(attr, "0")
    extent = ET.SubElement(inline, f"{WP}extent")
    extent.set("cx", str(cx))
    extent.set("cy", str(cy))
    docpr = ET.SubElement(inline, f"{WP}docPr")
    docpr.set("id", str(docpr_id))
    docpr.set("name", name)
    c_nv = ET.SubElement(inline, f"{WP}cNvGraphicFramePr")
    locks = ET.SubElement(c_nv, f"{A}graphicFrameLocks")
    locks.set("noChangeAspect", "1")
    graphic = ET.SubElement(inline, f"{A}graphic")
    graphic_data = ET.SubElement(graphic, f"{A}graphicData")
    graphic_data.set("uri", "http://schemas.openxmlformats.org/drawingml/2006/picture")
    pic = ET.SubElement(graphic_data, f"{PIC}pic")
    nv_pic_pr = ET.SubElement(pic, f"{PIC}nvPicPr")
    c_nv_pr = ET.SubElement(nv_pic_pr, f"{PIC}cNvPr")
    c_nv_pr.set("id", "0")
    c_nv_pr.set("name", name)
    ET.SubElement(nv_pic_pr, f"{PIC}cNvPicPr")
    blip_fill = ET.SubElement(pic, f"{PIC}blipFill")
    blip = ET.SubElement(blip_fill, f"{A}blip")
    blip.set(f"{R}embed", image_rid)
    stretch = ET.SubElement(blip_fill, f"{A}stretch")
    ET.SubElement(stretch, f"{A}fillRect")
    sp_pr = ET.SubElement(pic, f"{PIC}spPr")
    xfrm = ET.SubElement(sp_pr, f"{A}xfrm")
    off = ET.SubElement(xfrm, f"{A}off")
    off.set("x", "0")
    off.set("y", "0")
    ext = ET.SubElement(xfrm, f"{A}ext")
    ext.set("cx", str(cx))
    ext.set("cy", str(cy))
    prst = ET.SubElement(sp_pr, f"{A}prstGeom")
    prst.set("prst", "rect")
    ET.SubElement(prst, f"{A}avLst")
    return paragraph


def count_words(content_map):
    parts = []
    for section, paragraphs in content_map.items():
        parts.append(section)
        parts.extend(paragraphs)
    text = " ".join(parts)
    return len(re.findall(r"[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)?", text))


def main():
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE_PATH}")

    with ZipFile(TEMPLATE_PATH, "r") as template_zip:
        files = {name: template_zip.read(name) for name in template_zip.namelist()}

    document_root = ET.fromstring(files["word/document.xml"])
    rels_root = ET.fromstring(files["word/_rels/document.xml.rels"])
    styles_root = ET.fromstring(files["word/styles.xml"])
    style_map = load_style_name_map(styles_root)
    body = document_root.find("w:body", NS)

    paragraphs = [child for child in list(body) if child.tag == f"{W}p"]
    normal_template = None
    by_text = {}
    for paragraph in paragraphs:
        text = p_text(paragraph)
        if text and text not in by_text:
            by_text[text] = paragraph
        if normal_template is None and text.startswith("Delete the red paragraphs and replace this one with your content"):
            normal_template = paragraph
    if normal_template is None:
        raise RuntimeError("Could not locate a normal paragraph template in the Word file.")

    title_replacements = {
        "The Title Of Your Project": TITLE,
        "Your degree title here": DEGREE,
        "April 2026": DATE,
        "Your Full Name Here": AUTHOR,
        "Word count: XXXXX": f"Word count: {count_words(SECTION_CONTENT)}",
    }
    for old, new in title_replacements.items():
        paragraph = by_text.get(old)
        if paragraph is not None:
            clear_and_set_text(paragraph, new)

    appendix_a_old = "Appendix A – Interesting but not vital material"
    appendix_b_old = "Appendix B – Other things which may be useful"
    if appendix_a_old in by_text:
        clear_and_set_text(by_text[appendix_a_old], "Appendix A – Repository structure and key files")
    if appendix_b_old in by_text:
        clear_and_set_text(by_text[appendix_b_old], "Appendix B – Manual QA checklist summary")

    style_lookup = {paragraph: paragraph_style_name(paragraph, style_map) for paragraph in list(body) if paragraph.tag == f"{W}p"}
    for paragraph in list(body):
        if paragraph.tag == f"{W}p" and style_lookup.get(paragraph) == "Advice":
            body.remove(paragraph)

    heading_anchors = {}
    for paragraph in list(body):
        if paragraph.tag == f"{W}p":
            text = p_text(paragraph)
            if text:
                heading_anchors[text] = paragraph

    for heading, texts in SECTION_CONTENT.items():
        anchor = heading_anchors.get(heading)
        if anchor is None:
            continue
        new_paragraphs = [clone_normal_paragraph(normal_template, text) for text in texts]
        insert_after(body, anchor, new_paragraphs)

    figure_bytes = generate_report_figures()
    for index, spec in enumerate(FIGURE_SPECS, start=1):
        files[f"word/media/{spec['filename']}"] = figure_bytes[spec["key"]]
        rel_id = add_image_relationship(rels_root, f"media/{spec['filename']}")
        heading_anchor = heading_anchors.get(spec["heading"])
        if heading_anchor is None:
            continue
        image_paragraph = make_image_paragraph(
            rel_id,
            spec["caption"],
            spec["width_in"],
            spec["height_in"],
            100 + index,
        )
        caption_paragraph = clone_centered_paragraph(normal_template, spec["caption"])
        insert_after(body, heading_anchor, [image_paragraph, caption_paragraph])

    placeholder_prefixes = (
        "Delete the red paragraphs and replace this one with your content",
        "Delete the red paragraphs and replace the ones below with your content",
        "Delete the red paragraph and replace this one with your content",
    )
    for paragraph in list(body):
        if paragraph.tag != f"{W}p":
            continue
        text = p_text(paragraph)
        if any(text.startswith(prefix) for prefix in placeholder_prefixes):
            body.remove(paragraph)

    files["word/document.xml"] = ET.tostring(document_root, encoding="utf-8", xml_declaration=True)
    files["word/_rels/document.xml.rels"] = ET.tostring(rels_root, encoding="utf-8", xml_declaration=True)

    with ZipFile(OUTPUT_PATH, "w") as out_zip:
        for name, content in files.items():
            out_zip.writestr(name, content)

    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
