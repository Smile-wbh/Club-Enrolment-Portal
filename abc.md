# Club Management System - Four Core System Architecture

This project is organised around **four independent core pages or subsystems** based on the latest business plan. Each system serves different user roles and operational goals so that responsibilities stay clear and features remain well separated.

---

## 1. User Interaction System
**Audience:** general users  
**Core functions:** browse, book, learn, and interact  
**Main pages:** `index1.html` (home), `msjs.html`, `specialty.html`, `mfms.html`, `spjs.html`, `tzgg.html`, `join.html`

This system is the main platform entry point and provides a one-stop club service experience for ordinary users.

* **Home page (`index1.html`):**
  * Acts as the public portal of the platform.
  * Shows featured clubs and a platform introduction.
* **Browse and preview (`msjs.html`):**
  * Lets users browse all registered and approved clubs.
  * Shows club details, locations, and key highlights.
* **Activity booking (`specialty.html`):**
  * Allows logged-in users to book specific club activities.
  * Supports viewing remaining seats, time slots, and locations.
* **Teaching courses (`mfms.html`):**
  * Provides course booking services led by professional coaches.
  * Displays course content, pricing, and schedule details.
* **Community forum (`spjs.html`):**
  * Gives users a place to post, comment, like, and interact.
  * Helps users keep up with current activities and community insights.
* **Consultation service (`tzgg.html`):**
  * Provides official contact details and frequently asked questions.
  * Allows users to submit one-to-one support requests.
* **User center (`join.html`):**
  * Manages profile details and shows bookings and posts.
  * Includes entry points to club registration and club management.

---

## 2. Club Registration System
**Audience:** prospective club owners  
**Core functions:** submit applications and onboard to the platform  
**Main page:** `cart.html` (registration view)

This system is designed for incubating new clubs and guiding users through the transition from general user to club owner.

* **Application flow:**
  * **Eligibility check:** the user must log in first.
  * **Information form:** the user fills in the club name, category, detailed introduction, cover image, and other core information.
  * **Submit for review:** the application enters a pending review state after submission and waits for administrator approval.
* **Status feedback:**
  * Users can review the application progress from the user center or registration page, such as pending, approved, or rejected.

---

## 3. Club Management System
**Audience:** existing club owners  
**Core functions:** content maintenance, member management, and scheduling  
**Main page:** `cart.html` (management view)

This system is the operating backend for club owners and is used to maintain the club homepage and day-to-day operations.

* **Content updates:**
  * **Basic information:** edit the club introduction and update cover images.
  * **Announcements:** publish activity notices and urgent schedule changes.
* **Activity and course management:**
  * **Scheduling:** set activity times, locations, and maximum capacity.
  * **Seat adjustment:** increase or reduce available seats based on actual needs.
* **Member management:**
  * Review booked user lists.
  * Process check-ins or mark no-shows.

---

## 4. Admin Supervision System
**Audience:** platform super administrators  
**Core functions:** global supervision, review, and analytics  
**Main pages:** `admin/` page group (admin dashboard)

This system is the control center of the entire platform and ensures that site content stays compliant, safe, and healthy.

* **Global supervision:**
  * Monitor posts, comments, and support content across the site.
  * Handle user complaints and violations such as muting or banning accounts.
* **Review center:**
  * **Club review:** manually review applications submitted from the club registration system.
  * **Standards:** verify compliant naming, truthful information, and acceptable images.
* **Rule setting and enforcement:**
  * Define booking rules such as no-show penalties.
  * Define publishing rules such as sensitive-word filtering.
* **Data dashboard:**
  * **Core metrics:** user growth, daily activity, and total bookings.
  * **Popularity analysis:** rankings for the most popular clubs and trending courses.
