// --- GUMLOOP CONFIG ---
const GUMLOOP_API_KEY = "5c2d7adeeb5d4f08b697fd36638ebbda";
const GUMLOOP_USER_ID = "f3LAKxUglWel0Pg6grvwGUX8vVh2";
const GUMLOOP_FLOW_ID = "mSrGfoUjm9xcQGopybHg9h";

// --- 0. GATEKEEPER ---
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
    const globalContext = document.documentElement.getAttribute('data-global-context');
    if (globalContext) {
        try {
            const context = JSON.parse(globalContext);
            if (context.orgUnitId) return context.orgUnitId;
        } catch(e) {}
    }
    return null;
}

// --- 2. GLOBAL STORAGE HELPERS ---
let currentSessionPDFs = []; // PDFs found in the current course tab

async function updateMasterCount() {
    const data = await chrome.storage.local.get("masterList");
    const count = data.masterList ? data.masterList.length : 0;
    document.getElementById('master-count').innerText = `Master List: ${count} files`;
}

// --- 3. UI BUILDER ---
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
        .mcgill-btn { background: #ed1b2e; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; border-radius: 6px; margin-top: 8px; font-size: 11px; }
        .btn-append { background: #ffaa00; display: none; }
        .btn-gumloop { background: #6200ea; margin-top: 15px; }
        .btn-clear { background: #f4f4f4; color: #666; font-size: 9px; margin-top: 5px; }
        .status-bar { font-size: 12px; color: #ed1b2e; font-weight: bold; margin-bottom: 5px; }
        .event-preview-item { border-bottom: 1px solid #eee; padding: 6px 0; font-size: 11px; }
        .loader { border: 2px solid #f3f3f3; border-top: 2px solid #ed1b2e; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    const tool = document.createElement('div');
    tool.id = 'mcgill-calendar-tool';
    tool.innerHTML = `
        <div style="font-weight:bold; color:#ed1b2e; border-bottom: 2px solid #ed1b2e; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between;">
            <span>McGill Study Porter</span>
            <span style="cursor:pointer" id="close-mcgill">✕</span>
        </div>
        <div class="status-bar" id="master-count">Master List: 0 files</div>
        <div id="scan-status" style="font-size:11px; color:#666;">Scan a course to begin...</div>
        
        <div id="event-preview-list" style="max-height: 150px; overflow-y: auto; margin-top:10px; border: 1px solid #eee; padding: 5px;"></div>
        
        <button class="mcgill-btn" style="background:#333;" id="btn-crawl-pdfs">🤖 1. CRAWL CURRENT COURSE</button>
        <button class="mcgill-btn btn-append" id="btn-append-list">➕ 2. APPEND TO MASTER LIST</button>
        
        <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
        
        <button class="mcgill-btn" style="background:#28a745;" id="btn-download-master">💾 DOWNLOAD MASTER TXT</button>
        <button class="mcgill-btn btn-gumloop" id="btn-send-gumloop">🚀 SEND MASTER TO GUMLOOP</button>
        <button class="mcgill-btn btn-clear" id="btn-clear-master">🗑️ WIPE MASTER LIST</button>
    `;
    document.body.appendChild(tool);

    document.getElementById('close-mcgill').onclick = () => tool.remove();
    document.getElementById('btn-crawl-pdfs').onclick = crawlAllCategories;
    document.getElementById('btn-append-list').onclick = appendToMaster;
    document.getElementById('btn-download-master').onclick = downloadMasterList;
    document.getElementById('btn-send-gumloop').onclick = sendToGumloop;
    document.getElementById('btn-clear-master').onclick = clearMaster;
}

// --- 4. CRAWLER & TEXT EXTRACTION ---
async function extractTextFromPDF(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map(item => item.str).join(" ") + " ";
        }
        return fullText;
    } catch (e) { return "Error parsing PDF text."; }
}

async function crawlAllCategories() {
    const status = document.getElementById('scan-status');
    const listUI = document.getElementById('event-preview-list');
    const appendBtn = document.getElementById('btn-append-list');
    const orgUnitId = getOrgUnitId();

    if (!orgUnitId) { status.innerText = "Navigate to a course!"; return; }
    
    status.innerHTML = `<div class="loader"></div> Reading API...`;
    listUI.innerHTML = "";
    currentSessionPDFs = [];

    try {
        const apiUrl = `https://mycourses2.mcgill.ca/d2l/api/le/1.45/${orgUnitId}/content/toc`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        let files = [];
        const process = (mods) => {
            mods.forEach(m => {
                if (m.Topics) m.Topics.forEach(t => {
                    if (t.Url && t.Url.toLowerCase().includes('.pdf')) 
                        files.push({ title: t.Title, url: `https://mycourses2.mcgill.ca${t.Url}` });
                });
                if (m.Modules) process(m.Modules);
            });
        };
        process(data.Modules);

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                status.innerHTML = `<div class="loader"></div> Extraction: ${i+1}/${files.length}`;
                const text = await extractTextFromPDF(files[i].url);
                currentSessionPDFs.push({ 
                    course: document.title.split(' - ')[0],
                    title: files[i].title, 
                    url: files[i].url, 
                    content: text 
                });
                listUI.innerHTML += `<div class="event-preview-item">✓ ${files[i].title}</div>`;
            }
            status.innerText = `Found ${currentSessionPDFs.length} new files. Click Append!`;
            appendBtn.style.display = "block";
        } else { status.innerText = "No PDFs found."; }
    } catch (e) { status.innerText = "Crawl failed."; }
}

// --- 5. STORAGE LOGIC ---
async function appendToMaster() {
    const data = await chrome.storage.local.get("masterList");
    let masterList = data.masterList || [];
    
    // Combine current course PDFs with the master list, preventing duplicates by URL
    const combined = [...masterList];
    currentSessionPDFs.forEach(newFile => {
        if (!combined.some(oldFile => oldFile.url === newFile.url)) {
            combined.push(newFile);
        }
    });

    await chrome.storage.local.set({ "masterList": combined });
    document.getElementById('btn-append-list').style.display = "none";
    document.getElementById('scan-status').innerText = "Added to Master List!";
    updateMasterCount();
}

async function clearMaster() {
    if (confirm("Clear all accumulated course data?")) {
        await chrome.storage.local.remove("masterList");
        updateMasterCount();
        document.getElementById('event-preview-list').innerHTML = "";
    }
}

// --- 6. EXPORTERS ---
async function downloadMasterList() {
    const data = await chrome.storage.local.get("masterList");
    const list = data.masterList || [];
    if (list.length === 0) return alert("List is empty!");

    let output = "MCGILL MULTI-COURSE STUDY PACK\n\n";
    list.forEach(p => {
        output += `COURSE: ${p.course}\nTITLE: ${p.title}\nCONTENT:\n${p.content}\n-----------------------------------\n\n`;
    });
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = "McGill_Master_Study_Notes.txt"; link.click();
}

async function sendToGumloop() {
    const status = document.getElementById('scan-status');
    const data = await chrome.storage.local.get("masterList");
    const list = data.masterList || [];

    if (list.length === 0) return alert("List is empty!");

    status.innerHTML = `<div class="loader"></div> Sending ${list.length} files to Gumloop...`;

    // Sending first 100,000 characters to prevent 500 error if list is massive
    const fullText = list.map(p => `[${p.course}] ${p.title}: ${p.content}`).join("\n\n");
    
    const payload = {
        user_id: GUMLOOP_USER_ID,
        saved_item_id: GUMLOOP_FLOW_ID,
        pipeline_inputs: [
            {
                input_name: "lecture_data",
                value: fullText.substring(0, 150000) // Gumloop has limits, adjust as needed
            }
        ]
    };

    try {
        const response = await fetch("https://api.gumloop.com/api/v1/start_pipeline", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GUMLOOP_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok) {
            status.innerText = "✅ Sent to Gumloop!";
            window.open(result.url, '_blank');
        } else {
            status.innerText = "❌ Gumloop Error.";
        }
    } catch (e) { status.innerText = "❌ Network Error."; }
}