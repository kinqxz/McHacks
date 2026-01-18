// --- SYLLABUSTER CONFIGURATION ---
const GUMLOOP_API_KEY = "1d8914111c3648c2ab7d0b9ea0472c7f";
const GUMLOOP_USER_ID = "HA0VNm3y30Pi56n6AJTwr2v5Q292";
const GUMLOOP_FLOW_ID = "5L6o4KqyhX5XDfy6hw4y5L";

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
    if (el) el.innerText = `Master List: ${count} items saved`;
}

function buildDashboard() {
    if (document.getElementById('syllabuster-tool')) return;
    const style = document.createElement('style');
    style.textContent = `
        #syllabuster-tool { position: fixed; top: 20px; right: 20px; width: 340px; background: #fff; color: #333; border: 3px solid #ed1b2e; border-radius: 12px; padding: 15px; z-index: 2147483647; font-family: 'Segoe UI', sans-serif; box-shadow: 0px 8px 30px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto; }
        .mcgill-btn { background: #ed1b2e; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; border-radius: 6px; margin-top: 8px; font-size: 11px; transition: 0.2s; }
        .mcgill-btn:hover { opacity: 0.8; }
        .section-title { font-weight: bold; font-size: 12px; color: #ed1b2e; margin-top: 15px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
        .insight-card { background: #fff5f5; border-left: 4px solid #ed1b2e; padding: 8px; font-size: 11px; margin-top: 10px; border-radius: 4px; color: #444; }
        .calc-table { width: 100%; font-size: 10px; margin-top: 10px; border-collapse: collapse; }
        .calc-table td, .calc-table th { border: 1px solid #eee; padding: 4px; text-align: left; }
        .calc-input { width: 40px; border: 1px solid #ccc; font-size: 10px; }
        .loader { border: 2px solid #f3f3f3; border-top: 2px solid #ed1b2e; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 5px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
    
    const tool = document.createElement('div');
    tool.id = 'syllabuster-tool';
    tool.innerHTML = `
        <div style="font-weight:bold; color:#ed1b2e; border-bottom: 2px solid #ed1b2e; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>SYLLABUSTER PRO 🚀</span>
            <span style="cursor:pointer;" id="close-buster">✕</span>
        </div>
        <div id="master-count" style="font-weight:bold; font-size:12px; color:#ed1b2e;">Master List: 0 items</div>
        <div id="scan-status" style="font-size:10px; color:#666; margin: 5px 0;">Ready.</div>
        <div style="display:flex; gap:5px;">
            <button class="mcgill-btn" style="background:#333;" id="btn-crawl">1a. CRAWL PDFs</button>
            <button class="mcgill-btn" style="background:#007bff;" id="btn-events">1b. CRAWL CALENDAR</button>
        </div>
        <button class="mcgill-btn" style="background:#6200ea;" id="btn-generate">2. GENERATE INSIGHTS & .ICS</button>
        <div class="section-title">Conflict Detection (Insights)</div>
        <div id="insights-container"><div class="insight-card">No crunch weeks detected yet.</div></div>
        <div class="section-title">Grade Calculator</div>
        <div id="calculator-container" style="max-height:180px; overflow-y:auto;">
            <table class="calc-table" id="calc-table">
                <thead><tr><th>Assessment</th><th>Wgt%</th><th>Score%</th></tr></thead>
                <tbody></tbody>
            </table>
        </div>
        <button class="mcgill-btn" style="background:#f4f4f4; color:#666; font-size:9px;" id="btn-wipe">🗑️ WIPE ALL DATA</button>
    `;
    document.body.appendChild(tool);

    document.getElementById('btn-crawl').onclick = crawlCourse;
    document.getElementById('btn-events').onclick = crawlEvents;
    document.getElementById('btn-generate').onclick = startAIWorkflow;
    document.getElementById('btn-wipe').onclick = clearMaster;
    document.getElementById('close-buster').onclick = () => tool.remove();
}

// --- HELPER: SAVE TO STORAGE ---
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

// --- SCRAPING LOGIC ---
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
        status.innerText = `Successfully added ${scraped.length} PDFs to Master.`;
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
    if (confirm("This will delete all gathered course data. Continue?")) {
        await chrome.storage.local.set({ "masterList": [], "lastGeneratedEvents": [] });
        location.reload();
    }
}

// --- AI WORKFLOW ---
async function startAIWorkflow() {
    const status = document.getElementById('scan-status');
    const data = await chrome.storage.local.get("masterList");
    const list = data.masterList || [];
    if (list.length === 0) return alert("Crawl at least one course first!");

    status.innerHTML = `<div class="loader"></div> AI analyzing all courses...`;
    const fullText = list.map(p => `[${p.course}] ${p.content}`).join("\n\n").substring(0, 140000);

    chrome.runtime.sendMessage({
        type: "GUMLOOP_PROXY",
        url: `https://api.gumloop.com/api/v1/start_pipeline?api_key=${GUMLOOP_API_KEY}&user_id=${GUMLOOP_USER_ID}&saved_item_id=${GUMLOOP_FLOW_ID}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecture_data: fullText })
    }, (response) => {
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
                    status.innerText = "✅ Analysis Complete!";
                    processAIResponse(run.outputs.output);
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

        // Feature 2: Insights
        document.getElementById('insights-container').innerHTML = `<div class="insight-card">${insights}</div>`;

        // Feature 5: Grade Calculator (Save to storage so it persists)
        await chrome.storage.local.set({ "lastGeneratedEvents": events });
        renderGradeCalculator(events);

        // Feature 4: Study Plan (inside ICS)
        downloadICS(events);

    } catch (e) { console.error("Parse Error:", e); }
}

async function loadCalculatedGrades() {
    const data = await chrome.storage.local.get("lastGeneratedEvents");
    if (data.lastGeneratedEvents) renderGradeCalculator(data.lastGeneratedEvents);
}

function renderGradeCalculator(events) {
    const tbody = document.querySelector('#calc-table tbody');
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
        const date = (e.date || "20250101").replace(/\D/g, "");
        const studyPlan = `\nStudy Recommendation: Begin review 7 days before. Focus on core concepts from ${e.course}.`;

        ics += "BEGIN:VEVENT\n";
        ics += `UID:${Date.now()}-${Math.random().toString(36).substring(2)}@syllabuster.com\n`;
        ics += `DTSTART;VALUE=DATE:${date}\n`;
        ics += `SUMMARY:[${e.course || 'Course'}] ${e.title}\n`;
        ics += `DESCRIPTION:Weight: ${e.weight || 'N/A'}.${studyPlan}\n`;
        ics += "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "McGill_Master_Schedule.ics";
    link.click();
}