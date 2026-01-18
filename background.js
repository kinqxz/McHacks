// Listen for the extension icon click in the browser toolbar
chrome.action.onClicked.addListener((tab) => {
    // Check if we are on the McGill domain before sending
    if (tab.url && tab.url.includes("mycourses2.mcgill.ca")) {
        chrome.tabs.sendMessage(tab.id, { type: "REOPEN_UI" });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GUMLOOP_PROXY") {
        const fetchOptions = {
            method: request.method,
            headers: request.headers
        };
        if (request.body) fetchOptions.body = request.body;

        fetch(request.url, fetchOptions)
            .then(async (res) => {
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { isHtmlError: true, status: res.status, body: text.substring(0, 200) };
                }
            })
            .then(data => sendResponse({ success: true, data: data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true; 
    }
});