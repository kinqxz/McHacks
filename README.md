# 🎓 Syllabuster

**The Ultimate AI Study Companion for McGill Students.**

<div align="center">
  <img src="syllabusterTitle.png" alt="Syllabuster Logo" width="400">
  <br><br>
  <a href="https://gumloop.com">
    <img src="https://img.shields.io/badge/Powered%20by-Gumloop%20AI-ed1b2e?style=for-the-badge" alt="Powered by Gumloop">
  </a>
  <img src="https://img.shields.io/badge/Chrome-Extension-blue?style=for-the-badge" alt="Chrome Extension">
</div>

## 🚀 Overview

**Syllabuster** is a Chrome Extension designed to save McGill University students hours of tedious planning. By leveraging AI, it automatically scans course syllabi (PDFs) and calendar events from MyCourses to generate a unified, conflict-free Ultimate Schedule.

It doesn't just read dates; it understands them. It extracts weights, detects potential assignment conflicts, and exports everything directly to your Google/Apple Calendar.

## ✨ Key Features

### 🧠 AI-Powered Analysis
*   **Smart Extraction:** Scans course PDFs and Calendar events directly from the browser.
*   **Manual Upload:** Drag-and-drop syllabus PDFs if the scraper misses them.
*   **Conflict Detection:** AI analyzes your schedule to warn you about "crunch weeks" (e.g., 3 midterms in a week).

### 📅 Smart Scheduling
*   **One-Click Export:** Generates a `.ics` file compatible with Google Calendar, Outlook, and Apple Calendar.
*   **Smart Formatting:** Distinguishes between specific deadlines (e.g., "Due at 2:00 PM") and all-day events.
*   **Custom Horizon:** Choose to export the next 7 days, 1 month, or the full semester.

### ⚡ Student Productivity Tools
*   **Focus Timer (Pomodoro):** Built-in 25-minute timer to keep you on track without leaving the tab.
*   **Upcoming Deadlines:** A quick-glance dashboard of your next 5 deliverables (excluding lectures).
*   **Context Copy:** Copies your entire course load to the clipboard, formatted perfectly for ChatGPT and other LLMs (e.g., "Quiz me on COMP 202").

## 🛠️ Installation

Since this is a developer-mode extension for now, follow these steps to install:

1.  **Clone or Download** this repository.
2.  Ensure you have the **PDF.js** library files in the root folder:
    *   `pdf.min.js`
    *   `pdf.worker.min.js`
3.  Open Google Chrome and navigate to `chrome://extensions/`.
4.  Toggle **Developer mode** in the top right corner.
5.  Click **Load unpacked** and select the folder containing these files.
6.  Navigate to **MyCourses (McGill)** to start using the tool!

## 📖 How to Use

1.  **Navigate:** Go to your MyCourses homepage or a specific course page.
2.  **Open:** Click the Syllabuster icon in your browser toolbar.
3.  **Scan:**
    *   Click **"Scan PDFs"** to auto-grab syllabi.
    *   Click **"Scan Events"** to grab D2L calendar items.
    *   (Optional) Use **"Upload"** to manually add a PDF from your computer.
4.  **Personalize:** Add personal events (work, sports) in the "Add Personal Events" box.
5.  **Generate:** Click the glowing **"✨ Analyze & Generate"** button.
6.  **Export:** Once complete, review the "Upcoming Deadlines" preview and get your downloaded `.ics` calendar file.

## 🏗️ Tech Stack

*   **Frontend:** HTML5, CSS3 (Injected via JS), Vanilla JavaScript.
*   **Engine:** Chrome Extension Manifest V3.
*   **AI Logic:** [Gumloop](https://gumloop.com) (AI Pipeline Automation).
*   **PDF Parsing:** Mozilla PDF.js.

## 📂 File Structure

```text
/
├── manifest.json          # Extension configuration and permissions
├── content.js             # Main logic (UI injection, Scraper, API calls)
├── background.js          # Service worker
├── pdf.min.js             # PDF parsing library
├── pdf.worker.min.js      # PDF worker script
├── syllabusterTitle.png   # Logo asset
└── icon.png               # Extension toolbar icon
```

## ⚠️ Notes
*  **API Key:** This project uses a hardcoded demo API key for Gumloop. For production use, this should be moved to a secure backend or user input.
*  **McGill Specific:** The scraping logic is tailored for the Brightspace/D2L environment used by McGill University.
## 🏆 Hackathon Project
This project was built during a hackathon to solve the universal student struggle of "Syllabus Week."
