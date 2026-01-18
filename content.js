// --- SYLLABUSTER CONFIGURATION ---
const GUMLOOP_API_KEY = "1d8914111c3648c2ab7d0b9ea0472c7f";
const GUMLOOP_USER_ID = "HA0VNm3y30Pi56n6AJTwr2v5Q292";
const GUMLOOP_FLOW_ID = "5L6o4KqyhX5XDfy6hw4y5L";

// --- INITIALIZATION ---
if (window.self === window.top) {
    initUI();
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
        }
    }, 100);
}

function getOrgUnitId() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("ou")) return urlParams.get("ou");
    const pathMatch = window.location.pathname.match(/\/(?:home|lessons|content|grades|calendar)\/(\d+)/);
    if (pathMatch) return pathMatch[1];
    return null;
}

async function updateMasterCount() {
    try {
        const data = await chrome.storage.local.get("masterList");
        const count = (data && data.masterList) ? data.masterList.length : 0;
        const el = document.getElementById('master-count');
        if (el) el.innerText = `Master List: ${count} items`;
    } catch(e) {}
}

function buildDashboard() {
    if (document.getElementById('syllabuster-tool')) return;
    const style = document.createElement('style');
    style.textContent = `
        #syllabuster-tool { position: fixed; top: 20px; right: 20px; width: 320px; background: #fff; color: #333; border: 3px solid #ed1b2e; border-radius: 12px; padding: 15px; z-index: 2147483647; font-family: 'Segoe UI', sans-serif; box-shadow: 0px 8px 30px rgba(0,0,0,0.3); }
        .mcgill-btn { background: #ed1b2e; color: white; border: none; padding: 12px; width: 100%; cursor: pointer; font-weight: bold; border-radius: 6px; margin-top: 10px; font-size: 12px; }
        #btn-append { background: #ffaa00; display: none; }
        .btn-wipe { background: #f4f4f4; color: #666; font-size: 10px; margin-top: 15px; width: 100%; border: 1px solid #ddd; cursor: pointer; border-radius: 4px; padding: 6px; font-weight: bold; }
        .loader { border: 2px solid #f3f3f3; border-top: 2px solid #ed1b2e; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
    const tool = document.createElement('div');
    tool.id = 'syllabuster-tool';
    tool.innerHTML = `
        <div style="font-weight:bold; color:#ed1b2e; border-bottom: 2px solid #ed1b2e; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>SYLLABUSTER 🚀</span>
            <span style="cursor:pointer;" id="close-buster">✕</span>
        </div>
        <div id="master-count" style="font-weight:bold; font-size:13px; color:#ed1b2e;">Master List: 0 items</div>
        <div id="scan-status" style="font-size:11px; color:#666; margin: 10px 0;">Ready.</div>
        <button class="mcgill-btn" style="background:#333;" id="btn-crawl">1a. CRAWL PDFs</button>
        <button class="mcgill-btn" style="background:#007bff;" id="btn-events">1b. CRAWL CALENDAR</button>
        <button class="mcgill-btn" id="btn-append">2. APPEND TO MASTER</button>
        <button class="mcgill-btn" style="background:#6200ea;" id="btn-generate">3. GENERATE CALENDAR (.ics)</button>
        <button class="btn-wipe" id="btn-wipe">🗑️ WIPE DATA</button>
    `;
    document.body.appendChild(tool);
    document.getElementById('btn-crawl').onclick = crawlCourse;
    document.getElementById('btn-events').onclick = crawlEvents;
    document.getElementById('btn-append').onclick = appendToMaster;
    document.getElementById('btn-generate').onclick = startAIWorkflow;
    document.getElementById('btn-wipe').onclick = clearMaster;
}

// --- SCRAPING LOGIC ---
let currentSessionFiles = [];

// PDF CRAWLER
async function crawlCourse() {
    const status = document.getElementById('scan-status');
    const orgUnitId = getOrgUnitId();
    if (!orgUnitId) return status.innerText = "Error: Navigate to a course!";
    status.innerHTML = `<div class="loader"></div> Scraping PDFs...`;
    currentSessionFiles = [];
    try {
        const res = await fetch(`https://mycourses2.mcgill.ca/d2l/api/le/1.45/${orgUnitId}/content/toc`);
        const data = await res.json();
        let pdfs = [];
        const find = (m) => {
            m.forEach(mod => {
                if (mod.Topics) mod.Topics.forEach(t => { if (t.Url && t.Url.toLowerCase().endsWith('.pdf')) pdfs.push(t); });
                if (mod.Modules) find(mod.Modules);
            });
        };
        find(data.Modules);
        for (let i = 0; i < pdfs.length; i++) {
            status.innerHTML = `<div class="loader"></div> Parsing PDF ${i+1}/${pdfs.length}`;
            const pdfRes = await fetch(`https://mycourses2.mcgill.ca${pdfs[i].Url}`);
            const arrayBuffer = await pdfRes.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = "";
            for (let j = 1; j <= pdf.numPages; j++) {
                const page = await pdf.getPage(j);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(" ") + " ";
            }
            currentSessionFiles.push({ course: document.title.split(' - ')[0], content: text, url: pdfs[i].Url });
        }
        status.innerText = `Done. Found ${pdfs.length} PDFs. Click Append.`;
        document.getElementById('btn-append').style.display = "block";
    } catch (e) { status.innerText = "Crawl Error."; }
}

// CALENDAR EVENTS CRAWLER (New Feature)
async function crawlEvents() {
    const status = document.getElementById('scan-status');
    const orgUnitId = getOrgUnitId();
    if (!orgUnitId) return status.innerText = "Error: Navigate to a course!";
    
    status.innerHTML = `<div class="loader"></div> Scanning Calendar...`;
    
    // We fetch events for a wide range (Current date to 180 days in future)
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
        const res = await fetch(`https://mycourses2.mcgill.ca/d2l/api/le/1.45/${orgUnitId}/calendar/events/?startDateTime=${start}&endDateTime=${end}`);
        const events = await res.json();
        
        if (!Array.isArray(events)) throw new Error("Invalid response");

        events.forEach(e => {
            const eventText = `CALENDAR ITEM: ${e.Title} | Date: ${e.StartDateTime} | Description: ${e.DescriptionText || 'No description'}`;
            currentSessionFiles.push({ 
                course: document.title.split(' - ')[0], 
                content: eventText, 
                url: `calendar-event-${e.EventId}` 
            });
        });

        status.innerText = `Done. Found ${events.length} events. Click Append.`;
        document.getElementById('btn-append').style.display = "block";
    } catch (e) {
        console.error(e);
        status.innerText = "Calendar Crawl Error.";
    }
}

async function appendToMaster() {
    const data = await chrome.storage.local.get("masterList");
    let masterList = data.masterList || [];
    currentSessionFiles.forEach(f => { if (!masterList.some(old => old.url === f.url)) masterList.push(f); });
    await chrome.storage.local.set({ "masterList": masterList });
    currentSessionFiles = [];
    document.getElementById('btn-append').style.display = "none";
    updateMasterCount();
    document.getElementById('scan-status').innerText = "Added to Master List!";
}

async function clearMaster() {
    if (confirm("Delete all gathered data?")) {
        await chrome.storage.local.set({ "masterList": [] });
        await updateMasterCount();
        document.getElementById('scan-status').innerText = "Storage wiped.";
    }
}

// --- AI WORKFLOW & ICS GENERATOR ---
async function startAIWorkflow() {
    const status = document.getElementById('scan-status');
    const data = await chrome.storage.local.get("masterList");
    const list = data.masterList || [];
    if (!list || list.length === 0) return alert("Scrape a course first!");

    status.innerHTML = `<div class="loader"></div> AI is processing...`;
    // We send both PDF text and Calendar text to Gumloop
    const fullText = list.map(p => `[${p.course}] ${p.content}`).join("\n\n").substring(0, 140000);

    chrome.runtime.sendMessage({
        type: "GUMLOOP_PROXY",
        url: `https://api.gumloop.com/api/v1/start_pipeline?api_key=${GUMLOOP_API_KEY}&user_id=${GUMLOOP_USER_ID}&saved_item_id=${GUMLOOP_FLOW_ID}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecture_data: fullText })
    }, (response) => {
        if (!response.success || response.data.isHtmlError) {
            console.error("Pipeline Failed:", response.error);
            return status.innerText = "❌ AI Start Failed.";
        }

        const runId = response.data.run_id;
        const poll = setInterval(() => {
            if (!chrome.runtime?.id) { clearInterval(poll); return; }

            chrome.runtime.sendMessage({
                type: "GUMLOOP_PROXY",
                url: `https://api.gumloop.com/api/v1/get_pl_run?run_id=${runId}&user_id=${GUMLOOP_USER_ID}`,
                method: "GET",
                headers: { "Authorization": `Bearer ${GUMLOOP_API_KEY}` }
            }, (pollRes) => {
                if (!pollRes.success || !pollRes.data || pollRes.data.isHtmlError) return;

                const run = pollRes.data;
                if (run.state === "DONE") {
                    clearInterval(poll);
                    status.innerText = "✅ AI Done! Generating file...";
                    const rawOutput = run.outputs.output;
                    try {
                        const cleanJson = typeof rawOutput === 'string' 
                            ? rawOutput.replace(/```json|```/g, "").trim() 
                            : JSON.stringify(rawOutput);
                        
                        const events = JSON.parse(cleanJson);
                        downloadICS(events);
                        status.innerText = "✅ Calendar Saved!";
                    } catch (e) {
                        status.innerText = "❌ AI Format Error.";
                    }
                } else if (run.state === "FAILED") {
                    clearInterval(poll);
                    status.innerText = "❌ AI Workflow Failed.";
                }
            });
        }, 4000);
    });
}

function downloadICS(events) {
    if (!Array.isArray(events)) return;
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Syllabuster//EN\n";
    events.forEach(e => {
        const title = (e.title || "Assessment").replace(/[,;]/g, "");
        const course = (e.course || "Course").replace(/[,;]/g, "");
        const weight = e.weight || "N/A";
        const date = (e.date || "20250101").replace(/\D/g, "");

        ics += "BEGIN:VEVENT\n";
        ics += `UID:${Date.now()}-${Math.random().toString(36).substring(2)}@syllabuster.com\n`;
        ics += `DTSTART;VALUE=DATE:${date}\n`;
        ics += `SUMMARY:[${course}] ${title}\n`;
        ics += `DESCRIPTION:Weight: ${weight}\n`;
        ics += "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "McGill_Academic_Schedule.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}