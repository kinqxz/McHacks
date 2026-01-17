// --- 0. GATEKEEPER: Only build UI in the main window ---
if (window.self === window.top) {
    initUI();
}

function initUI() {
    // Wait for page to be ready
    const checkBody = setInterval(() => {
        if (document.body) {
            clearInterval(checkBody);
            buildDashboard();
        }
    }, 100);
}

// --- 1. SMART ID FINDER ---
function getOrgUnitId() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("ou")) return urlParams.get("ou");

    const pathMatch = window.location.pathname.match(/\/(?:home|lessons|content|grades|calendar)\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const globalContext = document.documentElement.getAttribute('data-global-context');
    if (globalContext) {
        try {
            const context = JSON.parse(globalContext);
            if (context.orgUnitId) return context.orgUnitId;
        } catch(e) {}
    }
    return null;
}

// --- 2. UI BUILDER ---
function buildDashboard() {
    if (document.getElementById('mcgill-calendar-tool')) return;

    const style = document.createElement('style');
    style.textContent = `
        #mcgill-calendar-tool {
            position: fixed; top: 20px; right: 20px; width: 320px;
            background: #fff; color: #333; border: 3px solid #ed1b2e;
            border-radius: 12px; padding: 15px; z-index: 2147483647;
            font-family: 'Segoe UI', Arial, sans-serif; box-shadow: 0px 8px 30px rgba(0,0,0,0.3);
        }
        .mcgill-btn { background: #ed1b2e; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; border-radius: 6px; margin-top: 10px; }
        .mcgill-btn:hover { background: #b11221; }
        .btn-crawler { background: #333; }
        .event-preview-item { border-bottom: 1px solid #eee; padding: 8px 0; font-size: 12px; word-break: break-word; }
        .event-date-badge { background: #fdf2f2; color: #ed1b2e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-right: 5px; }
        .loader { border: 3px solid #f3f3f3; border-top: 3px solid #ed1b2e; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px;}
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    const tool = document.createElement('div');
    tool.id = 'mcgill-calendar-tool';
    tool.innerHTML = `
        <div style="font-weight:bold; color:#ed1b2e; border-bottom: 2px solid #ed1b2e; padding-bottom:8px; margin-bottom:10px; display:flex; justify-content:space-between;">
            <span>McGill Pro Tool</span>
            <span style="cursor:pointer" id="close-mcgill">✕</span>
        </div>
        <div id="scan-status" style="font-size:12px; color:#666;">Ready...</div>
        <div id="event-preview-list" style="max-height: 250px; overflow-y: auto; margin-top:10px;"></div>
        <button class="mcgill-btn" id="btn-scan-events">📅 SCAN UPCOMING EVENTS</button>
        <button class="mcgill-btn btn-crawler" id="btn-crawl-pdfs">🤖 CRAWL ALL PDFs (API)</button>
        <button class="mcgill-btn" id="btn-ics" style="display:none; background:#ed1b2e;">📥 DOWNLOAD .ICS</button>
    `;
    document.body.appendChild(tool);

    document.getElementById('close-mcgill').onclick = () => tool.remove();
    document.getElementById('btn-scan-events').onclick = scanEvents;
    document.getElementById('btn-crawl-pdfs').onclick = crawlAllCategories;
    document.getElementById('btn-ics').onclick = downloadICS;

    const id = getOrgUnitId();
    if (id) document.getElementById('scan-status').innerText = "Course Detected (ID: " + id + ")";
}

// --- 3. EVENT SCANNER (For Assignments) ---
let assignments = [];
function scanEvents() {
    assignments = [];
    const listUI = document.getElementById('event-preview-list');
    listUI.innerHTML = "";
    const monthMap = { "JAN": 0, "FEB": 1, "MAR": 2, "APR": 3, "MAY": 4, "JUN": 5, "JUL": 6, "AUG": 7, "SEP": 8, "OCT": 9, "NOV": 10, "DEC": 11 };

    const findInDoc = (doc) => {
        doc.querySelectorAll('.d2l-datalist-item-content').forEach(item => {
            const textBlocks = item.querySelectorAll('.d2l-textblock');
            if (textBlocks.length >= 3) {
                const monthText = textBlocks[0].innerText.trim().toUpperCase();
                const dayText = textBlocks[1].innerText.trim();
                const title = item.getAttribute('title')?.replace('View Event - ', '') || textBlocks[textBlocks.length - 1].innerText;
                if (monthMap.hasOwnProperty(monthText)) {
                    assignments.push({ title, month: monthMap[monthText], day: parseInt(dayText) });
                    listUI.innerHTML += `<div class="event-preview-item"><span class="event-date-badge">${monthText} ${dayText}</span> ${title}</div>`;
                }
            }
        });
    };

    findInDoc(document);
    document.querySelectorAll('iframe').forEach(f => { try { findInDoc(f.contentDocument || f.contentWindow.document); } catch (e) {} });

    document.getElementById('scan-status').innerText = assignments.length > 0 ? `Found ${assignments.length} assignments.` : "No events found.";
    if (assignments.length > 0) document.getElementById('btn-ics').style.display = "block";
}

// --- 4. API-BASED PDF CRAWLER ---
async function crawlAllCategories() {
    const status = document.getElementById('scan-status');
    const listUI = document.getElementById('event-preview-list');
    const orgUnitId = getOrgUnitId();

    if (!orgUnitId) { status.innerText = "Error: Navigate to a course first!"; return; }

    status.innerHTML = `<div class="loader"></div> Querying McGill API...`;
    listUI.innerHTML = "";

    // Target API endpoint
    const apiUrl = `https://mycourses2.mcgill.ca/d2l/api/le/1.45/${orgUnitId}/content/toc`;
    
    // PRINT TO CONSOLE: The API URL being fetched
    console.log("FETCHING FROM API URL:", apiUrl);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        let pdfs = [];
        const processModules = (modules) => {
            modules.forEach(mod => {
                if (mod.Topics) {
                    mod.Topics.forEach(t => {
                        if (t.Url && t.Url.toLowerCase().includes('.pdf')) {
                            const fullPdfUrl = `https://mycourses2.mcgill.ca${t.Url}`;
                            
                            // PRINT TO CONSOLE: Each individual PDF URL found
                            console.log("FOUND PDF URL:", fullPdfUrl);
                            
                            pdfs.push({ title: t.Title, url: fullPdfUrl });
                        }
                    });
                }
                if (mod.Modules) processModules(mod.Modules);
            });
        };

        processModules(data.Modules);

        if (pdfs.length > 0) {
            status.innerText = `Success! Found ${pdfs.length} files.`;
            pdfs.forEach(p => {
                listUI.innerHTML += `<div class="event-preview-item">📄 <a href="${p.url}" target="_blank" style="color:#ed1b2e; font-weight:bold; text-decoration:none;">${p.title}</a></div>`;
            });
        } else {
            status.innerText = "No PDFs found in the API response.";
        }
    } catch (e) {
        status.innerText = "API access blocked. Click 'Content' tab once then retry.";
    }
}

// --- 5. CALENDAR GENERATOR ---
function downloadICS() {
    let ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//McGill Tool//EN"];
    assignments.forEach(asm => {
        const d = new Date(new Date().getFullYear(), asm.month, asm.day, 23, 59);
        const ds = d.toISOString().replace(/[-:]/g, '').split('.')[0].slice(0, 8);
        ics.push("BEGIN:VEVENT", `DTSTART:${ds}T235900`, `SUMMARY:${asm.title}`, "END:VEVENT");
    });
    ics.push("END:VCALENDAR");
    const blob = new Blob([ics.join("\r\n")], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = "McGill_Schedule.ics"; link.click();
}