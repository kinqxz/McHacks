// --- 1. UI STYLING ---
const style = document.createElement('style');
style.textContent = `
    #mcgill-calendar-tool {
        position: fixed; top: 20px; right: 20px; width: 320px;
        background: #fff; color: #333; border: 3px solid #ed1b2e;
        border-radius: 12px; padding: 15px; z-index: 2147483647;
        font-family: 'Segoe UI', Arial, sans-serif; box-shadow: 0px 8px 30px rgba(0,0,0,0.3);
    }
    .mcgill-btn { background: #ed1b2e; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; border-radius: 6px; margin-top: 10px; transition: 0.2s; }
    .mcgill-btn:hover { background: #b11221; }
    .event-preview-item { border-bottom: 1px solid #eee; padding: 8px 0; font-size: 13px; }
    .event-date-badge { background: #fdf2f2; color: #ed1b2e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-right: 5px; }
`;
document.head.appendChild(style);

// --- 2. THE DASHBOARD ---
const tool = document.createElement('div');
tool.id = 'mcgill-calendar-tool';
tool.innerHTML = `
    <div style="font-weight:bold; color:#ed1b2e; border-bottom: 2px solid #ed1b2e; padding-bottom:8px; margin-bottom:10px; display:flex; justify-content:space-between;">
        <span>McGill Assignment Scraper</span>
        <span style="cursor:pointer" onclick="this.parentElement.parentElement.remove()">✕</span>
    </div>
    <div id="scan-status" style="font-size:12px; color:#666;">Waiting for scan...</div>
    <div id="event-preview-list" style="max-height: 250px; overflow-y: auto; margin-top:10px;"></div>
    <button class="mcgill-btn" id="btn-scan">🔍 SCAN UPCOMING EVENTS</button>
    <button class="mcgill-btn" id="btn-ics" style="display:none; background:#333;">📅 DOWNLOAD .ICS CALENDAR</button>
`;
document.body.appendChild(tool);

let assignments = [];

const monthMap = { "JAN": 0, "FEB": 1, "MAR": 2, "APR": 3, "MAY": 4, "JUN": 5, "JUL": 6, "AUG": 7, "SEP": 8, "OCT": 9, "NOV": 10, "DEC": 11 };

function scrapeAssignments() {
    assignments = [];
    const listUI = document.getElementById('event-preview-list');
    listUI.innerHTML = "";
    
    // Target the specific container from your snippet
    const items = document.querySelectorAll('.d2l-datalist-item-content');

    items.forEach(item => {
        const textBlocks = item.querySelectorAll('.d2l-textblock');
        
        // From your snippet: 
        // Index 0: Month ("JAN")
        // Index 1: Day ("25")
        // Index 2+: Title and Time info
        if (textBlocks.length >= 3) {
            const monthText = textBlocks[0].innerText.trim().toUpperCase();
            const dayText = textBlocks[1].innerText.trim();
            
            // The title is usually in the last textblock or the title attribute
            const title = item.getAttribute('title')?.replace('View Event - ', '') || textBlocks[textBlocks.length - 1].innerText;

            if (monthMap.hasOwnProperty(monthText)) {
                assignments.push({
                    title: title,
                    month: monthMap[monthText],
                    day: parseInt(dayText),
                    rawDate: `${monthText} ${dayText}`
                });

                const div = document.createElement('div');
                div.className = 'event-preview-item';
                div.innerHTML = `<span class="event-date-badge">${monthText} ${dayText}</span> ${title}`;
                listUI.appendChild(div);
            }
        }
    });

    if (assignments.length > 0) {
        document.getElementById('scan-status').innerText = `Success! Found ${assignments.length} assignments.`;
        document.getElementById('btn-ics').style.display = "block";
    } else {
        document.getElementById('scan-status').innerText = "No events found. Make sure the 'Upcoming Events' widget is visible.";
    }
}

function generateICS() {
    let icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//McGill Assignment Tool//EN"
    ];

    const currentYear = new Date().getFullYear();

    assignments.forEach(asm => {
        // Construct the date
        const eventDate = new Date(currentYear, asm.month, asm.day, 23, 59, 0);
        const dateStr = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0].slice(0, 8);

        icsContent.push("BEGIN:VEVENT");
        icsContent.push(`DTSTART:${dateStr}T235900`); // Set for 11:59 PM
        icsContent.push(`DTEND:${dateStr}T235959`);
        icsContent.push(`SUMMARY:${asm.title}`);
        icsContent.push(`DESCRIPTION:Assignment found via McGill MyCourses Scraper`);
        icsContent.push("END:VEVENT");
    });

    icsContent.push("END:VCALENDAR");

    const blob = new Blob([icsContent.join("\r\n")], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `McGill_Assignments.ics`;
    link.click();
}

document.getElementById('btn-scan').onclick = scrapeAssignments;
document.getElementById('btn-ics').onclick = generateICS;