// --- SYLLABUSTER CONFIGURATION ---
const GUMLOOP_API_KEY = "5c2d7adeeb5d4f08b697fd36638ebbda";
const GUMLOOP_USER_ID = "f3LAKxUglWel0Pg6grvwGUX8vVh2";
const GUMLOOP_FLOW_ID = "djjPMLFhsfhp82tWFGGVnE";

// https://api.gumloop.com/api/v1/start_pipeline?api_key=5c2d7adeeb5d4f08b697fd36638ebbda&user_id=f3LAKxUglWel0Pg6grvwGUX8vVh2&saved_item_id=djjPMLFhsfhp82tWFGGVnE

// --- INITIALIZATION ---
if (window.self === window.top) {
    initUI();
    // Listen for storage changes so the UI updates across all tabs
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.masterList) updateMasterCount();
    });
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
    }
}

function initUI() {
    const checkBody = setInterval(() => {
        if (document.body) {
            clearInterval(checkBody);
            buildDashboard();
            updateMasterCount();
            loadCalculatedGrades(); // Load grades if already generated
        }
    }, 100);
}

function getOrgUnitId() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("ou")) return urlParams.get("ou");
    const pathMatch = window.location.pathname.match(/\/(?:home|lessons|content|grades|calendar)\/(\d+)/);
    return pathMatch ? pathMatch[1] : null;
}

async function updateMasterCount() {
    const data = await chrome.storage.local.get("masterList");
    const count = (data && data.masterList) ? data.masterList.length : 0;
    const el = document.getElementById('master-count');
    if (el) el.innerText = `Event List: ${count} items saved`;
}

function buildDashboard() {
    if (document.getElementById('syllabuster-tool')) return;

    const logoUrl = chrome.runtime.getURL("syllabusterTitle.png");

    const style = document.createElement('style');
    style.textContent = `
        /* 1. MAIN CONTAINER (The Glowing Gradient Shell) */
        #syllabuster-tool { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            width: 340px; 
            z-index: 2147483647; 
            font-family: 'Segoe UI', sans-serif; 
            
            /* PADDING acts as the BORDER THICKNESS (4px) */
            padding: 4px; 
            border-radius: 16px; 
            
            /* The Animated Gradient */
            background: linear-gradient(135deg, #c20013, #ff4d4d, #8a000d, #c20013);
            background-size: 300% 300%;
            animation: border-pulse 6s ease infinite;
            
            /* The "Pop" (Dual Shadows: One for depth, one for glow) */
            box-shadow: 
                0 5px 20px rgba(0,0,0,0.4),      /* Depth */
                0 0 15px rgba(237, 27, 46, 0.6);  /* Red Glow */
        }

        @keyframes border-pulse {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        /* 2. INNER CONTENT (The White Card & Scrolling) */
        .tool-content {
            background: #fff;
            color: #333;
            border-radius: 12px; /* Slightly smaller than parent */
            padding: 15px;
            
            /* SCROLLING happens here now, so the glow is never clipped */
            max-height: 85vh; 
            overflow-y: auto; 
        }

        /* --- UI ELEMENTS --- */
        .mcgill-btn { background: #c20013; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; border-radius: 6px; margin-top: 8px; font-size: 11px; transition: 0.2s; }
        .mcgill-btn:hover { opacity: 0.8; }
        
        .controls-row { display: flex; gap: 5px; margin-top: 12px; align-items: center; }

        .time-select { width: 100%; padding: 10px 25px 10px 10px; border: 1px solid #ccc; border-radius: 6px; width: 100%; font-family: inherit; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #999; background-color: #fff; outline: none; cursor: pointer; text-align: center; text-align-last: center; transition: 0.2s; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2082.2c3.6-3.6%205.4-7.8%205.4-12.8%200-5-1.8-9.3-5.4-12.9z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 10px center; background-size: 8px; }
        .time-select:hover { border-color: #c20013; color: #c20013; }

        #btn-wipe { margin-top: 0 !important; background: #fff; color: #999; max-width: 153px; border: 1px solid #ccc; font-size: 9px; }
        #btn-wipe:hover { border-color: #c20013; color: #c20013; }

        #btn-generate { background: linear-gradient(45deg, #c20013 0%, #ff4d4d 100%); color: white; border: none; padding: 12px; width: 100%; cursor: pointer; font-weight: 700; border-radius: 6px; margin-top: 15px; font-size: 13px; text-transform: none; letter-spacing: 0.3px; box-shadow: 0 4px 15px rgba(194, 0, 19, 0.5); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); position: relative; overflow: hidden; animation: pulse-glow 2.5s infinite ease-in-out; }
        #btn-generate:hover { transform: translateY(-2px) scale(1.01); box-shadow: 0 8px 25px rgba(194, 0, 19, 0.75), 0 0 10px rgba(255, 77, 77, 0.5); filter: brightness(1.1); }
        #btn-generate.processing { pointer-events: none; cursor: wait; box-shadow: 0 0 20px rgba(255, 77, 77, 0.8); transform: scale(0.98); }
        #btn-generate.processing::after { content: ""; position: absolute; top: 0; left: -150%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0.1) 80%, transparent 100%); transform: skewX(-25deg); animation: speed-bar-anim 1s infinite linear; }
        
        @keyframes speed-bar-anim { 0% { left: -150%; } 100% { left: 150%; } }
        @keyframes pulse-glow { 0% { box-shadow: 0 4px 15px rgba(194, 0, 19, 0.5); } 50% { box-shadow: 0 0 25px rgba(194, 0, 19, 0.8), 0 0 12px rgba(255, 77, 77, 0.6); } 100% { box-shadow: 0 4px 15px rgba(194, 0, 19, 0.5); } }

        .accordion-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 12px; color: #c20013; margin-top: 15px; padding-bottom: 5px; border-bottom: 1px solid #eee; user-select: none; }
        .arrow-icon { display: inline-block; width: 8px; height: 8px; border: solid #c20013; border-width: 0 2px 2px 0; transform-origin: 50% 50%; transform: rotate(135deg); transition: transform 0.3s ease; margin-right: 5px; }
        .accordion-header.active .arrow-icon { transform: rotate(45deg); }
        .accordion-content { max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease; }
        .accordion-content.open { opacity: 1; }
        .inner-pad { padding-top: 10px; padding-bottom: 5px; }
        .insight-card { background: #fff5f5; border-left: 4px solid #c20013; padding: 8px; font-size: 11px; border-radius: 4px; color: #444; }
        .calc-table { width: 100%; font-size: 10px; border-collapse: collapse; }
        .calc-table td, .calc-table th { border: 1px solid #eee; padding: 4px; text-align: left; }
        .calc-input { width: 40px; border: 1px solid #ccc; font-size: 10px; border-radius:3px; padding:2px; text-align:center; }
        .calc-input:focus { border-color: #c20013; outline:none; }
        .personal-area { width: 94%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; font-size: 11px; resize: vertical; margin-bottom: 5px; outline: none; }
        .personal-area:focus { border-color: #c20013; }
        .loader { border: 2px solid #f3f3f3; border-top: 2px solid #c20013; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 5px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    const tool = document.createElement('div');
    tool.id = 'syllabuster-tool';

    // IMPORTANT: Wrapped content in "tool-content" div
    tool.innerHTML = `
        <div class="tool-content">
            <div style="border-bottom: 2px solid #c20013; padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                 <img src="${logoUrl}" alt="Syllabuster Pro" style="max-height: 60px; max-width: 350px; display: block;">
                <span style="cursor:pointer; font-weight:bold; color:#c20013;" id="close-buster">✕</span>
            </div>
            
            <div id="master-count" style="font-weight:bold; font-size:12px; color:#c20013;">Event List: 0 items</div>
            <div id="scan-status" style="font-size:10px; color:#666; margin: 5px 0;">Ready to collect data ...</div>
            
            <div style="display:flex; gap:5px;">
                <button class="mcgill-btn" style="background:#444;" id="btn-crawl">Scan all PDFs</button>
                <button class="mcgill-btn" style="background:#444;" id="btn-events">Scan events</button>
            </div>
            
            <button id="btn-generate">✨ Analyze & Generate</button>
            
            <div class="controls-row">
                <div style="flex: 1;">
                    <select id="time-horizon" class="time-select">
                        <option value="7" selected>NEXT 7 DAYS</option>
                        <option value="14">NEXT 14 DAYS</option>
                        <option value="30">1 MONTH</option>
                        <option value="120">FULL SEMESTER</option>
                    </select>
                </div>
                <button id="btn-wipe" class="mcgill-btn" style="flex: 1;">WIPE ALL DATA</button>
            </div>
            
            <div class="accordion-header" id="head-personal">
                <span>Add Personal Events</span>
                <span class="arrow-icon"></span>
            </div>
            <div class="accordion-content" id="cont-personal">
                <div class="inner-pad">
                    <textarea id="personal-input" class="personal-area" rows="3" placeholder="Ex: 'Part-time work every Friday 2-6pm'."></textarea>
                    <button id="btn-add-personal" class="mcgill-btn" style="margin-top:0; background:#444;">+ Add to the list of events</button>
                </div>
            </div>

            <div class="accordion-header" id="head-insights">
                <span>Conflict Detection (Insights)</span>
                <span class="arrow-icon"></span>
            </div>
            <div class="accordion-content" id="cont-insights">
                <div id="insights-container" class="inner-pad"><div class="insight-card">No crunch weeks detected yet.</div></div>
            </div>

            <div class="accordion-header" id="head-calc">
                <span>Grade Calculator</span>
                <span class="arrow-icon"></span>
            </div>
            <div class="accordion-content" id="cont-calc">
                <div class="inner-pad">
                    <div id="calculator-container" style="max-height:180px; overflow-y:auto;">
                        <table class="calc-table" id="calc-table">
                            <thead><tr><th>Assessment</th><th>Wgt%</th><th>Score%</th></tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
   `;
    document.body.appendChild(tool);

    document.getElementById('btn-crawl').onclick = crawlCourse;
    document.getElementById('btn-events').onclick = crawlEvents;
    document.getElementById('btn-generate').onclick = startAIWorkflow;
    document.getElementById('btn-wipe').onclick = clearMaster;
    document.getElementById('close-buster').onclick = () => tool.remove();

    document.getElementById('btn-add-personal').onclick = async () => {
        const input = document.getElementById('personal-input');
        const text = input.value.trim();
        if (!text) return;
        const newItem = {
            course: "Personal",
            content: `PERSONAL ENTRY: ${text}`,
            url: `personal-${Date.now()}`
        };
        await saveToMaster([newItem]);
        await updateMasterCount();
        input.value = "";
        const btn = document.getElementById('btn-add-personal');
        const oldText = btn.innerText;
        btn.innerText = "Saved!";
        setTimeout(() => btn.innerText = oldText, 1000);
    };

    function toggleSection(headerId, contentId) {
        const header = document.getElementById(headerId);
        const content = document.getElementById(contentId);
        header.addEventListener('click', () => {
            const isOpen = content.classList.contains('open');
            if (isOpen) {
                content.style.maxHeight = content.scrollHeight + "px";
                requestAnimationFrame(() => {
                    content.style.maxHeight = null;
                    content.classList.remove('open');
                    header.classList.remove('active');
                });
            } else {
                content.classList.add('open');
                header.classList.add('active');
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    }

    toggleSection('head-personal', 'cont-personal');
    toggleSection('head-insights', 'cont-insights');
    toggleSection('head-calc', 'cont-calc');
}


async function saveToMaster(newItems) {
    const data = await chrome.storage.local.get("masterList");
    let masterList = data.masterList || [];
    newItems.forEach(item => {
        if (!masterList.some(old => old.url === item.url)) {
            masterList.push(item);
        }
    });
    await chrome.storage.local.set({ "masterList": masterList });
}

async function crawlCourse() {
    const status = document.getElementById('scan-status');
    const orgUnitId = getOrgUnitId();
    if (!orgUnitId) return status.innerText = "Error: Navigate to a course!";
    status.innerHTML = `<div class="loader"></div> Scraping PDFs...`;
    try {
        const res = await fetch(`https://mycourses2.mcgill.ca/d2l/api/le/1.45/${orgUnitId}/content/toc`);
        const data = await res.json();
        let pdfs = [];
        const find = (m) => m.forEach(mod => {
            if (mod.Topics) mod.Topics.forEach(t => { if (t.Url?.toLowerCase().endsWith('.pdf')) pdfs.push(t); });
            if (mod.Modules) find(mod.Modules);
        });
        find(data.Modules);
        let scraped = [];
        for (let i = 0; i < pdfs.length; i++) {
            status.innerHTML = `<div class="loader"></div> PDF ${i+1}/${pdfs.length}`;
            const pdfRes = await fetch(`https://mycourses2.mcgill.ca${pdfs[i].Url}`);
            const arrayBuffer = await pdfRes.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = "";
            for (let j = 1; j <= pdf.numPages; j++) {
                const page = await pdf.getPage(j);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(" ") + " ";
            }
            scraped.push({ course: document.title.split(' - ')[0], content: text, url: pdfs[i].Url });
        }
        await saveToMaster(scraped);
        status.innerText = `Successfully added ${scraped.length} PDFs to the list of events.`;
    } catch (e) { status.innerText = "Crawl Error."; }
}

async function crawlEvents() {
    const status = document.getElementById('scan-status');
    const orgUnitId = getOrgUnitId();
    if (!orgUnitId) return status.innerText = "Error: Navigate to a course!";
    status.innerHTML = `<div class="loader"></div> Scanning Calendar...`;
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
    try {
        const res = await fetch(`https://mycourses2.mcgill.ca/d2l/api/le/1.45/${orgUnitId}/calendar/events/?startDateTime=${start}&endDateTime=${end}`);
        const events = await res.json();
        let scraped = events.map(e => ({
            course: document.title.split(' - ')[0],
            content: `CALENDAR EVENT: ${e.Title} Date: ${e.StartDateTime}`,
            url: `evt-${e.EventId}`
        }));
        await saveToMaster(scraped);
        status.innerText = `Added ${scraped.length} calendar items.`;
    } catch (e) { status.innerText = "Calendar Error."; }
}

async function clearMaster() {
    if (confirm("This will delete all gathered data. Continue?")) {
        await chrome.storage.local.set({ "masterList": [], "lastGeneratedEvents": [] });
        location.reload();
    }
}

async function startAIWorkflow() {
    const status = document.getElementById('scan-status');
    const btn = document.getElementById('btn-generate'); // GET BUTTON
    const data = await chrome.storage.local.get("masterList");
    const list = data.masterList || [];

    const personalInput = document.getElementById('personal-input');
    let tempText = "";
    if (personalInput && personalInput.value.trim() !== "") {
        tempText = `\n\n[MY_SCHEDULE] MANDATORY SCHEDULE EVENT: ${personalInput.value.trim()}`;
    }

    if (list.length === 0 && tempText === "") return alert("Crawl at least one course first!");

    // --- ENABLE LOADING EFFECT ---
    status.innerHTML = `<div class="loader"></div> AI analyzing...`;
    btn.classList.add("processing"); // Triggers CSS animation
    const originalBtnText = btn.innerText;
    btn.innerText = "✨ Processing...";
    // -----------------------------

    let fullText = list.map(p => `[${p.course}] ${p.content}`).join("\n\n");
    fullText += tempText;
    fullText = fullText.substring(0, 140000);

    chrome.runtime.sendMessage({
        type: "GUMLOOP_PROXY",
        url: `https://api.gumloop.com/api/v1/start_pipeline?api_key=${GUMLOOP_API_KEY}&user_id=${GUMLOOP_USER_ID}&saved_item_id=${GUMLOOP_FLOW_ID}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecture_data: fullText })
    }, (response) => {
        if (!response || !response.data) {
            status.innerText = "Connection Error (Check API)";
            // DISABLE LOADING EFFECT ON ERROR
            btn.classList.remove("processing");
            btn.innerText = originalBtnText;
            return;
        }
        const runId = response.data.run_id;
        const poll = setInterval(() => {
            chrome.runtime.sendMessage({
                type: "GUMLOOP_PROXY",
                url: `https://api.gumloop.com/api/v1/get_pl_run?run_id=${runId}&user_id=${GUMLOOP_USER_ID}`,
                method: "GET",
                headers: { "Authorization": `Bearer ${GUMLOOP_API_KEY}` }
            }, (pollRes) => {
                const run = pollRes.data;
                if (run.state === "DONE") {
                    clearInterval(poll);
                    status.innerText = "Analysis Complete!";
                    processAIResponse(run.outputs.output);

                    // --- DISABLE LOADING EFFECT ON SUCCESS ---
                    btn.classList.remove("processing");
                    btn.innerText = originalBtnText;
                    // ----------------------------------------
                }
            });
        }, 4000);
    });
}


async function processAIResponse(rawOutput) {
    try {
        const cleanJson = typeof rawOutput === 'string' ? rawOutput.replace(/```json|```/g, "").trim() : JSON.stringify(rawOutput);
        const result = JSON.parse(cleanJson);
        const events = Array.isArray(result) ? result : (result.events || []);
        const insights = result.insights || "No major conflicts detected.";
        document.getElementById('insights-container').innerHTML = `<div class="insight-card">${insights}</div>`;
        await chrome.storage.local.set({ "lastGeneratedEvents": events });
        renderGradeCalculator(events);
        downloadICS(events);
    } catch (e) { console.error("Parse Error:", e); }
}

async function loadCalculatedGrades() {
    const data = await chrome.storage.local.get("lastGeneratedEvents");
    if (data.lastGeneratedEvents) renderGradeCalculator(data.lastGeneratedEvents);
}

function renderGradeCalculator(events) {
    const tbody = document.querySelector('#calc-table tbody');
    if (!tbody) return;
    tbody.innerHTML = "";
    events.forEach((e) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${e.title}</td>
            <td>${e.weight || 0}%</td>
            <td><input type="number" class="calc-input" data-weight="${parseFloat(e.weight) || 0}" placeholder="0"></td>
        `;
        tbody.appendChild(row);
    });
    document.querySelectorAll('.calc-input').forEach(input => {
        input.oninput = () => {
            let totalGrade = 0;
            document.querySelectorAll('.calc-input').forEach(i => {
                const w = parseFloat(i.dataset.weight);
                const val = parseFloat(i.value) || 0;
                totalGrade += (val * (w / 100));
            });
            document.getElementById('scan-status').innerText = `Est. Current Grade: ${totalGrade.toFixed(2)}%`;
        };
    });
}

function downloadICS(events) {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Syllabuster//EN\n";

    events.forEach(e => {
        // 1. Clean the string to just numbers and T
        let startRaw = (e.date || "20250101").replace(/[^0-9T]/g, "");
        let endRaw = (e.end_date || "").replace(/[^0-9T]/g, "");

        // 2. AI FIX: If it has 12+ digits but missing 'T', insert it
        if (!startRaw.includes("T") && startRaw.length >= 12) {
            startRaw = startRaw.substring(0, 8) + "T" + startRaw.substring(8);
        }
        if (endRaw && !endRaw.includes("T") && endRaw.length >= 12) {
            endRaw = endRaw.substring(0, 8) + "T" + endRaw.substring(8);
        }

        // --- FIX STARTS HERE ---
        // Only add the "Weight:" text if e.weight actually exists
        const weightInfo = e.weight ? `Weight: ${e.weight}.` : "";
        const studyPlan = `\nStudy Recommendation: Begin review 7 days before. Focus on core concepts from ${e.course}.`;
        // -----------------------

        ics += "BEGIN:VEVENT\n";
        ics += `UID:${Date.now()}-${Math.random().toString(36).substring(2)}@syllabuster.com\n`;

        // 3. LOGIC: Determine if this is All Day or Specific Time
        const isSpecificTime = startRaw.includes("T") && !startRaw.includes("T000000");

        if (isSpecificTime) {
            ics += `DTSTART:${startRaw}\n`;
            if (endRaw && endRaw.length > 8 && endRaw !== startRaw) {
                ics += `DTEND:${endRaw}\n`;
            } else {
                ics += `DTEND:${startRaw}\n`;
            }
        } else {
            const dateOnly = startRaw.substring(0, 8);
            ics += `DTSTART;VALUE=DATE:${dateOnly}\n`;
        }

        ics += `SUMMARY:[${e.course || 'Course'}] ${e.title}\n`;

        // Use the conditional variable here
        ics += `DESCRIPTION:${weightInfo}${studyPlan}\n`;

        ics += "END:VEVENT\n";
    });

    ics += "END:VCALENDAR";

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "McGill_Schedule_.ics";
    link.click();
}

// --- NEW LISTENER FOR RE-OPENING UI ---
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "REOPEN_UI") {
        buildDashboard();
        updateMasterCount();
        loadCalculatedGrades();
    }
});