document.addEventListener('DOMContentLoaded', function() {
    loadParams();
}, false);

window.addEventListener('popstate', () => {
    loadParams();
});

const form = document.getElementById('searchForm');
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const searchBtn = document.getElementById("searchButton");
    if (searchBtn && (searchBtn.disabled || searchBtn.classList.contains("is-loading"))) {
        return;
    }
    ['since', 'until'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.autoPopulated === "true") {
            el.value = "";
            delete el.dataset.autoPopulated;
        }
    });
    updateClearDateButtons();
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    if (!validateDateRange()) {
        const untilEl = document.getElementById("until");
        if (untilEl) untilEl.reportValidity();
        return;
    }
    if (!validateScoreRange()) {
        const maxScoreEl = document.getElementById("max_score");
        if (maxScoreEl) maxScoreEl.reportValidity();
        return;
    }
    search(form);
});

function validateScoreRange() {
    const minEl = document.getElementById("min_score");
    const maxEl = document.getElementById("max_score");
    if (!minEl || !maxEl) return true;

    if (minEl.value.trim() !== '' && maxEl.value.trim() !== '') {
        const minVal = parseInt(minEl.value.trim(), 10);
        const maxVal = parseInt(maxEl.value.trim(), 10);
        if (!isNaN(minVal) && !isNaN(maxVal) && maxVal < minVal) {
            maxEl.setCustomValidity("Please enter a value greater than or equal to 'Min Score'");
            return false;
        }
    }
    maxEl.setCustomValidity("");
    return true;
}

function validateDateRange() {
    const sinceEl = document.getElementById("since");
    const untilEl = document.getElementById("until");
    if (!sinceEl || !untilEl) return true;

    if (sinceEl.value && untilEl.value) {
        const sinceTime = new Date(sinceEl.value).getTime();
        const untilTime = new Date(untilEl.value).getTime();
        if (!isNaN(sinceTime) && !isNaN(untilTime) && untilTime <= sinceTime) {
            untilEl.setCustomValidity("Please select a date later than the 'After' date");
            return false;
        }
    }
    untilEl.setCustomValidity("");
    return true;
}

function clearDate(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
    delete el.dataset.autoPopulated;
    validateDateRange();
    updateClearDateButtons();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateClearDateButtons() {
    ['since', 'until'].forEach(id => {
        const el = document.getElementById(id);
        const btn = document.getElementById(`clear-${id}`);
        if (el && btn) {
            const hasCommittedValue = Boolean(el.value) && el.dataset.autoPopulated !== "true";
            if (!hasCommittedValue) {
                btn.classList.add('is-hidden');
            } else if (document.activeElement !== el) {
                btn.classList.remove('is-hidden');
            }
        }
    });
}

function loadParams() {
    form.reset();
    getAccessToken();
    getSettings();
    const urlParams = new URLSearchParams(window.location.search).entries();
    for (const param of urlParams) {
        try {
            let value;
            if (param[0] == "until" || param[0] == "since") {
                const num = Number(param[1]);
                if (!isNaN(num)) {
                    const date = new Date(num * 1000);
                    if (!isNaN(date.getTime())) {
                        const offset = date.getTimezoneOffset() * 60000;
                        value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
                    }
                }
            } else if (param[0] == "author") {
                value = param[1].replace(/^(\/)?u\//i, '');
            } else if (param[0] == "subreddit") {
                value = param[1].replace(/^(\/)?r\//i, '');
            } else {
                value = param[1];
            }
            const targetId = param[0] === "ids" ? "q" : param[0];
            const el = document.getElementById(targetId);
            if (el && value !== undefined) {
                if (el.type === "checkbox") {
                    el.checked = (value === "true" || value === "1");
                } else {
                    el.value = value;
                }
            }
        } catch(e) {
            console.log(e);
        }
    }
    validateDateRange();
    validateScoreRange();
    updateClearDateButtons();
}

function getAccessToken() {
    try {
        const stored = localStorage.getItem("accessToken");
        if (stored) {
            document.getElementById("accessToken").value = stored.replace(/['"]+/g, "").trim();
        }
    } catch {}
}

function clearAccessToken(userInitiated = false) {
    try {
        localStorage.removeItem("accessToken");
    } catch {}
    form.elements['accessToken'].value = "";
    if (userInitiated) {
        document.getElementById("apiInfo").innerHTML = "";
        const el = document.getElementById("accessToken");
        if (el) el.focus();
    }
}

const settingKeys = ["exactAuthorMatch", "renderMarkdown", "highlight", "showThumbnails"];

settingKeys.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("change", () => {
            try {
                localStorage.setItem(id, el.checked);
            } catch {}
        });
    }
});

['since', 'until'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const populateDefault = () => {
            if (!el.value) {
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                const localDate = new Date(now - offset).toISOString().slice(0, 10);
                el.value = `${localDate}T00:00`;
                el.dataset.autoPopulated = "true";
            }
        };

        el.addEventListener('pointerdown', populateDefault);

        el.addEventListener('keydown', (e) => {
            if (!el.value && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
                populateDefault();
            } else if (e.key !== 'Tab' && e.key !== 'Escape') {
                delete el.dataset.autoPopulated;
            }
        });

        el.addEventListener('input', () => {
            delete el.dataset.autoPopulated;
            validateDateRange();
            updateClearDateButtons();
        });

        el.addEventListener('change', () => {
            delete el.dataset.autoPopulated;
            validateDateRange();
            updateClearDateButtons();
        });

        el.addEventListener('blur', () => {
            if (el.dataset.autoPopulated === "true") {
                el.value = "";
                delete el.dataset.autoPopulated;
            }
            validateDateRange();
            updateClearDateButtons();
        });
    }
});

['min_score', 'max_score'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', validateScoreRange);
        el.addEventListener('change', validateScoreRange);
    }
});

const limitEl = document.getElementById('limit');
if (limitEl) {
    limitEl.addEventListener('input', () => limitEl.setCustomValidity(''));
}

const tokenEl = document.getElementById('accessToken');
if (tokenEl) {
    tokenEl.addEventListener('focus', () => {
        tokenEl.type = 'text';
    });
    tokenEl.addEventListener('blur', () => {
        tokenEl.type = 'password';
    });
}

function getSettings() {
    settingKeys.forEach(id => {
        try {
            const val = localStorage.getItem(id);
            if (val !== null) {
                const el = document.getElementById(id);
                if (el) {
                    el.checked = (val === "true");
                }
            }
        } catch {}
    });
}

let latestCurlCommand = "";
let currentJsonBlobURL = null;
let accumulatedResults = [];
let copyTimeout;
let activeSearchConfig = null;
let currentSearchSessionId = 0;

async function copyCurl(btnElement) {
    if (!latestCurlCommand) return;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(latestCurlCommand);
        } else {
            const ta = document.createElement("textarea");
            ta.value = latestCurlCommand;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        if (btnElement) {
            btnElement.innerText = "Copied!";
            clearTimeout(copyTimeout);
            copyTimeout = setTimeout(() => {
                btnElement.innerText = "Copy cURL";
            }, 1500);
        }
    } catch (err) {
        console.error("Failed to copy cURL:", err);
    }
}

async function ensureMinLoadingTime(startTime, minDuration = 500) {
    const elapsed = Date.now() - startTime;
    if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }
}

async function search(form, until=-1, isRetry=false) {
    if (until < 0 && !isRetry) {
        currentSearchSessionId++;
    }
    const searchSessionId = currentSearchSessionId;
    
    if (until < 0) {    // New Search
        const searchBtn = document.getElementById("searchButton");
        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.classList.add("is-loading");
        }
        document.getElementById("results").innerHTML = "";
        accumulatedResults = [];
        if (until == -1) {
            document.getElementById("apiInfo").innerHTML = "";
            if (currentJsonBlobURL) {
                URL.revokeObjectURL(currentJsonBlobURL);
                currentJsonBlobURL = null;
            }
        }
    } else {            // Fetch More
        const fetchBtn = document.getElementById("fetch-" + until);
        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.classList.add("is-loading");
        }
    }

    let psURL;
    let path = "?";
    let currentLimit = 100;

    if (until >= 0 && activeSearchConfig) {
        psURL = activeSearchConfig.psBaseURL + "&until=" + until;
        currentLimit = activeSearchConfig.limit;
    } else {
        let min_score, max_score, since, formUntil;
        if (form.elements['kind'].value == "submission") {
            psURL = "https://api.pushshift.io/reddit/submission/search?html_decode=True";
            path += "kind=submission";
        } else {
            psURL = "https://api.pushshift.io/reddit/comment/search?html_decode=True";
            path += "kind=comment";
        }

        const authorEl = form.elements['author'];
        const rawAuthor = authorEl.value.trim().replace(/^(\/)?u\//i, '');
        if (rawAuthor !== '') {
            authorEl.value = rawAuthor;
            const encodedAuthor = encodeURIComponent(rawAuthor);
            psURL += "&author=" + encodedAuthor;
            if (form.elements['exactAuthorMatch'].checked) {
                psURL += "&exact_author=true";
            }
            path += "&author=" + encodedAuthor;
        }

        const subredditEl = form.elements['subreddit'];
        const rawSubreddit = subredditEl.value.trim().replace(/^(\/)?r\//i, '');
        if (rawSubreddit !== '') {
            subredditEl.value = rawSubreddit;
            const encodedSubreddit = encodeURIComponent(rawSubreddit);
            psURL += "&subreddit=" + encodedSubreddit;
            path += "&subreddit=" + encodedSubreddit;
        }

        const rawMinScore = form.elements['min_score'].value.trim();
        if (rawMinScore !== '') {
            const parsedMin = parseInt(rawMinScore, 10);
            if (isNaN(parsedMin)) {
                const minScoreEl = document.getElementById("min_score");
                if (minScoreEl) {
                    minScoreEl.setCustomValidity("Please enter an integer");
                    minScoreEl.reportValidity();
                }
                return;
            }
            min_score = parsedMin;
            psURL += "&min_score=" + min_score;
            path += "&min_score=" + min_score;
        }

        const rawMaxScore = form.elements['max_score'].value.trim();
        if (rawMaxScore !== '') {
            const parsedMax = parseInt(rawMaxScore, 10);
            if (isNaN(parsedMax)) {
                const maxScoreEl = document.getElementById("max_score");
                if (maxScoreEl) {
                    maxScoreEl.setCustomValidity("Please enter an integer");
                    maxScoreEl.reportValidity();
                }
                return;
            }
            max_score = parsedMax;
            psURL += "&max_score=" + max_score;
            path += "&max_score=" + max_score;
        }

        if (min_score !== undefined && max_score !== undefined) {
            if (max_score < min_score) {
                const maxScoreEl = document.getElementById("max_score");
                if (maxScoreEl) {
                    maxScoreEl.setCustomValidity("Please enter a value greater than or equal to 'Min Score'");
                    maxScoreEl.reportValidity();
                }
                return;
            }
        }

        if (form.elements['since'].value.trim() !== '') {
            const parsedSince = new Date(form.elements['since'].value).valueOf() / 1000;
            if (!isNaN(parsedSince)) {
                since = parsedSince;
                psURL += "&since=" + since;
                path += "&since=" + since;
            }
        }

        if (until >= 0) {
            psURL += "&until=" + until;
        } else if (form.elements['until'].value.trim() !== '') {
            const parsedFormUntil = new Date(form.elements['until'].value).valueOf() / 1000;
            if (!isNaN(parsedFormUntil)) {
                if (since !== undefined && parsedFormUntil <= since) {
                    const untilEl = document.getElementById("until");
                    if (untilEl) {
                        untilEl.setCustomValidity("Please select a date later than the 'After' date");
                        untilEl.reportValidity();
                    }
                    return;
                }
                formUntil = parsedFormUntil;
            }
        }

        const queryVal = form.elements['q'].value.trim();
        if (queryVal !== '') {
            const encodedQuery = encodeURIComponent(queryVal);
            if (form.elements['kind'].value == "submission" && queryVal.startsWith("t3_")) {
                psURL += "&ids=" + encodedQuery;
            } else if (form.elements['kind'].value == "comment" && queryVal.startsWith("t1_")) {
                psURL += "&ids=" + encodedQuery;
            } else {
                psURL += "&q=" + encodedQuery;
            }
            path += "&q=" + encodedQuery;
        }

        const rawLimit = form.elements['limit'].value.trim();
        if (rawLimit === '') {
            currentLimit = 100;
            psURL += "&limit=100";
            path += "&limit=100";
        } else {
            const limit = parseInt(rawLimit, 10);
            const limitEl = document.getElementById("limit");
            if (isNaN(limit) || String(limit) !== rawLimit) {
                if (limitEl) {
                    limitEl.setCustomValidity("Please enter an integer between 1 and 1000");
                    limitEl.reportValidity();
                }
                return;
            } else if (limit < 1 || limit > 1000) {
                if (limitEl) {
                    limitEl.setCustomValidity("Value must be between 1 and 1000");
                    limitEl.reportValidity();
                }
                return;
            }
            if (limitEl) limitEl.setCustomValidity("");
            currentLimit = limit;
            psURL += "&limit=" + limit;
            path += "&limit=" + limit;
        }

        if (until < 0) {
            activeSearchConfig = {
                psBaseURL: psURL,
                limit: currentLimit,
                searchTerm: queryVal,
                highlight: form.elements['highlight'].checked
            };
            if (formUntil !== undefined) {
                psURL += "&until=" + formUntil;
                path += "&until=" + formUntil;
            }
        }
    }
    
    if (until < 0) {	// Search
        if (until == -1) {
            history.pushState(Date.now(), "Reddit Search - Results", window.location.pathname + path);
        }
    }
    let accessToken = parseAccessTokenInput();
    let exactAuthorMatch = form.elements['exactAuthorMatch'].checked;
    let renderMarkdown = form.elements['renderMarkdown'].checked;
    let highlight = form.elements['highlight'].checked;
    let showThumbnails = form.elements['showThumbnails'].checked;
    try {
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("exactAuthorMatch", exactAuthorMatch);
        localStorage.setItem("renderMarkdown", renderMarkdown);
        localStorage.setItem("highlight", highlight);
        localStorage.setItem("showThumbnails", showThumbnails);
    } catch {}

    const safeUrl = psURL.replaceAll("'", "%27");
    const safeToken = accessToken ? accessToken.replaceAll("'", "'\\''") : "";
    latestCurlCommand = accessToken 
        ? `curl '${safeUrl}' \\\n  -H 'Authorization: Bearer ${safeToken}'`
        : `curl '${safeUrl}'`;

    const searchStartTime = Date.now();

    try {
        const json = await load(psURL, accessToken);
        if (searchSessionId !== currentSearchSessionId) {
            return;
        }
        await ensureMinLoadingTime(searchStartTime);
        if (searchSessionId !== currentSearchSessionId) {
            return;
        }

        if (!json || typeof json !== "object") {
            throw new Error("Invalid response from Pushshift API");
        }

        if ("detail" in json) {
            let detail = json.detail;
            if (typeof detail === "string") {
                try {
                    const parsed = JSON.parse(detail);
                    if (parsed && parsed.detail) {
                        detail = parsed.detail;
                    }
                } catch {}
            } else if (Array.isArray(detail)) {
                detail = detail.map(d => (d && d.msg) ? d.msg : JSON.stringify(d)).join(", ");
            }
            console.log(detail);

            const detailLower = (typeof detail === "string") ? detail.toLowerCase() : "";

            if (detailLower.includes("token") && detailLower.includes("revoked")) {
                trackEvent('token-revoked');
                clearAccessToken();
                document.getElementById("apiInfo").innerHTML = `
                    Revoked Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                    title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                `;
            } else if (detailLower.includes("token") && detailLower.includes("expired")) {
                if (isRetry) {
                    trackEvent('refresh-fail');
                    clearAccessToken();
                    document.getElementById("apiInfo").innerHTML = `
                        Error Refreshing Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                        title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                    `;
                    return;
                }
                document.getElementById("apiInfo").innerHTML = "Refreshing Token...";
                const token = await refreshToken(accessToken);
                if (token == null) {
                    trackEvent('refresh-fail');
                    clearAccessToken();
                    document.getElementById("apiInfo").innerHTML = `
                        Error Refreshing Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                        title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                    `;
                    return;
                } else {
                    trackEvent('refresh-success');
                    document.getElementById("accessToken").value = token;
                    try {
                        localStorage.setItem("accessToken", token);
                    } catch {}
                    const retryUntil = (until == -1) ? -2 : until;
                    await search(form, retryUntil, true);
                    return;
                }
            } else if ((detailLower.includes("token") && (detailLower.includes("invalid") || detailLower.includes("malformed"))) || detailLower.includes("not authenticated")) {
                trackEvent('token-invalid');
                clearAccessToken();
                document.getElementById("apiInfo").innerHTML = `
                    Invalid Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                    title="Request access token from Pushshift" class="has-text-danger">Request Token</a>
                `;
            } else {
                trackEvent('error-request');
                if (currentJsonBlobURL) {
                    URL.revokeObjectURL(currentJsonBlobURL);
                }
                const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
                currentJsonBlobURL = URL.createObjectURL(blob);

                const errorMsg = (typeof detail === "string" && detail.length > 0) ? detail : "Pushshift May Be Down";
                document.getElementById("apiInfo").innerHTML = `
                    <div>
                        <span class="has-text-grey-lighter has-text-weight-semibold">Search Error: ${errorMsg}</span>
                    </div>
                    <div class="is-size-7 mt-1">
                        <a href="${currentJsonBlobURL}" target="_blank" rel="noopener noreferrer" title="View raw JSON response" class="has-text-grey-light">View JSON</a>
                        <span class="has-text-grey mx-1">·</span>
                        <a href="#" onclick="event.preventDefault(); copyCurl(this);" title="Copy cURL command to clipboard" class="has-text-grey-light">Copy cURL</a>
                    </div>
                `;
            }
            return;
        }

        if (!Array.isArray(json.data)) {
            throw new Error("Missing data array in response");
        }

        const oldFetchButton = document.getElementById("fetch-" + until);
        if (oldFetchButton) {
            oldFetchButton.remove();
        }

        const seenIds = new Set(accumulatedResults.map(item => item && item.id).filter(Boolean));
        const uniqueData = [];
        for (const item of json.data) {
            if (!item || !item.id) {
                uniqueData.push(item);
            } else if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                uniqueData.push(item);
            }
        }

        const rawNextUntil = (json.data.length > 0 && json.data[json.data.length - 1].created_utc != null)
            ? json.data[json.data.length - 1].created_utc
            : null;

        const hasMore = (json.data.length >= currentLimit) && (uniqueData.length > 0);
        const isEnd = !hasMore && ((accumulatedResults.length + uniqueData.length) > 0);

        const resultsContainer = document.getElementById("results");
        const prevCardCount = resultsContainer.querySelectorAll(".card").length;

        const renderMarkdown = form.elements['renderMarkdown'].checked;
        const showThumbnails = form.elements['showThumbnails'].checked;

        const html = generateHTML(uniqueData, renderMarkdown, showThumbnails, hasMore, rawNextUntil, isEnd);
        resultsContainer.insertAdjacentHTML("beforeend", html);

        const newCards = Array.from(resultsContainer.querySelectorAll(".card")).slice(prevCardCount);

        // Highlight search terms
        const searchTerm = (activeSearchConfig ? activeSearchConfig.searchTerm : form.elements['q'].value).trim();
        const highlightSetting = activeSearchConfig ? activeSearchConfig.highlight : form.elements['highlight'].checked;
        if (highlightSetting && searchTerm.length > 0 && newCards.length > 0) {
            let instance = new Mark(newCards);
            if (!searchTerm.startsWith('"')) {
                let searchArray = searchTerm.split(/\s+/).filter(Boolean);
                instance.mark(searchArray, {
                    "wildcards": "enabled",
                    "accuracy": "complementary"
                });
            } else {
                let term = searchTerm.replaceAll('"', "");
                instance.mark(term, {
                    "accuracy": "partially",
                    "separateWordSearch": false
                });
            }
        }

        accumulatedResults = accumulatedResults.concat(uniqueData);
        const result_count = accumulatedResults.length;

        if (currentJsonBlobURL) {
            URL.revokeObjectURL(currentJsonBlobURL);
        }
        const accumulatedJson = { ...json, data: accumulatedResults };
        const blob = new Blob([JSON.stringify(accumulatedJson, null, 2)], { type: "application/json" });
        currentJsonBlobURL = URL.createObjectURL(blob);

        document.getElementById("apiInfo").innerHTML = `
            <div>
                <span class="has-text-weight-bold has-text-white">
                    ${until == -2 ? "<span class='has-text-weight-normal mr-1'>Token Refreshed -</span>" : ""}
                    <span id="result_count">${result_count}</span> Result${result_count == 1 ? "" : "s"}
                </span>
            </div>
            <div class="is-size-7 mt-1">
                <a href="${currentJsonBlobURL}" target="_blank" rel="noopener noreferrer" title="View raw JSON response" class="has-text-grey-light">View JSON</a>
                <span class="has-text-grey mx-1">·</span>
                <a href="#" onclick="event.preventDefault(); copyCurl(this);" title="Copy cURL command to clipboard" class="has-text-grey-light">Copy cURL</a>
            </div>
        `;

        // Inject buttons for expanding linked media
        const extensions = [".jpg", ".jpeg", ".png", ".gif", ".gifv", ".mp4"];
        for (const card of newCards) {
            const links = card.querySelectorAll(".expand a");
            for (const link of links) {
                if (link.nextElementSibling == null || link.nextElementSibling.tagName != "BUTTON") {
                    const url = link.href;
                    if (extensions.some(extension => url.includes(extension))) {
                        const button = document.createElement("button");
                        button.classList.add("delete", "closed");
                        button.setAttribute("onclick", "directExpand(this)");
                        link.after(button);
                    }
                }
            }
        }

    } catch (e) {
        await ensureMinLoadingTime(searchStartTime);
        console.log(e);
        trackEvent('error-response');
        document.getElementById("apiInfo").innerHTML = `
            <div>
                <span class="has-text-grey-lighter has-text-weight-semibold">Search Error: Pushshift May Be Down</span>
            </div>
            <div class="is-size-7 mt-1">
                <a href="#" onclick="event.preventDefault(); copyCurl(this);" title="Copy cURL command to clipboard" class="has-text-grey-light">Copy cURL</a>
            </div>
        `;
    } finally {
        await ensureMinLoadingTime(searchStartTime);
        if (searchSessionId === currentSearchSessionId) {
            const searchBtn = document.getElementById("searchButton");
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.classList.remove("is-loading");
            }
            if (until >= 0) {
                const fetchBtn = document.getElementById("fetch-" + until);
                if (fetchBtn) {
                    fetchBtn.disabled = false;
                    fetchBtn.classList.remove("is-loading");
                }
            }
        }
    }
}

function fetchMore(until) {
    const btn = document.getElementById("fetch-" + until);
    if (btn) {
        if (btn.disabled || btn.classList.contains("is-loading")) {
            return;
        }
        btn.disabled = true;
        btn.classList.add("is-loading");
    }
    search(form, until);
}

function generateHTML(data, renderMarkdown, showThumbnails, hasMore = true, nextUntil = null, isEnd = false) {
    let count = 0;
    let html = "";
    let until = (nextUntil != null) ? nextUntil : 2147483647;
    
    data.forEach(obj => {
        count += 1;
        if (nextUntil == null && obj && obj.created_utc != null) {
            until = obj.created_utc;
        }
        
        let timestamp = "";
        let utcTimestamp = "";
        if (obj.created_utc) {
            const date = new Date(obj.created_utc * 1000);
            if (!isNaN(date.getTime())) {
                timestamp = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                utcTimestamp = date.toISOString().replace(".000Z", "Z");
            }
        }

        const subreddit = escapeHTML(obj.subreddit || "");
        const rawAuthor = obj.author || "[deleted]";
        const author = escapeHTML(rawAuthor);
        const lowerAuthor = author.toLowerCase();
        const isAuthorDeleted = lowerAuthor === "[deleted]" || lowerAuthor === "[removed]";
        let authorHtml;
        if (isAuthorDeleted) {
            const authorTitle = lowerAuthor === "[removed]" ? "Removed by moderator or Reddit" : "Deleted by user";
            authorHtml = `<span class="has-text-grey ml-1" title="${authorTitle}">${author}</span>`;
        } else {
            authorHtml = `<a href="https://reddit.com/user/${author}" target="_blank" rel="noopener noreferrer" title="View user on Reddit" class="has-text-danger ml-1">u/${author}</a>`;
        }

        const permalink = obj.permalink ? encodeURI(obj.permalink) : "";
        let redditUrl;
        if ("link_id" in obj) {
            redditUrl = obj.permalink
                ? "https://reddit.com" + permalink
                : `https://reddit.com/comments/${encodeURIComponent(obj.link_id.replace("t3_", ""))}/-/${encodeURIComponent(obj.id)}`;
        } else {
            redditUrl = obj.permalink
                ? "https://reddit.com" + permalink
                : `https://reddit.com/comments/${encodeURIComponent(obj.id)}`;
        }

        const scoreText = obj.score != null ? obj.score.toLocaleString() : "0";
        const isNsfw = Boolean(obj.over_18);
        const nsfwBadge = isNsfw ? `<span class="tag is-danger has-text-weight-bold nsfw-badge ml-2 mb-0" title="Not Safe For Work">NSFW</span>` : "";

        let statsHtml = `<span class="score">Score: ${scoreText}</span>`;
        if (timestamp) {
            statsHtml = `<span class="score mr-1">Score: ${scoreText}</span> · <span class="timestamp ml-1"><span class="local-time">${timestamp}</span><span class="utc-time">${utcTimestamp}</span></span>`;
        }

        html += `
            <div class="card has-text-grey-light my-4">
                <div class="card-content">
                    <div class="content mb-3">
                        <nav class="level">
                            <div class="level-left">
                                <div class="level-item is-block-mobile">
                                    <a href="https://reddit.com/r/${subreddit}" target="_blank" rel="noopener noreferrer" title="View subreddit on Reddit" class="has-text-danger mr-1">r/${subreddit}</a>
                                    ·
                                    ${authorHtml}${nsfwBadge}
                                </div>
                            </div>
                            <div class="level-right">
                                <div class="level-item is-block-mobile">
                                    <p class="is-size-7">
                                        ${statsHtml}
                                    </p>
                                </div>
                            </div>
                        </nav>
                    </div>
        `;

        if ("link_id" in obj) {  // Comment
            html += `
                    <div class="content mb-3 markdown expand wrap">
                        ${formatText(obj.body, renderMarkdown)}
                    </div>
            `;
        } else {  // Post
            const formattedSelftext = formatText(obj.selftext, renderMarkdown);
            const mediaMargin = (!obj.is_self || !formattedSelftext) ? "mb-3" : "mb-2";

            html += `
                    <div class="media ${mediaMargin}">
            `;

            if (showThumbnails && "thumbnail" in obj && typeof obj.thumbnail === "string" && obj.thumbnail.startsWith("http")) {
                const thumbUrl = escapeHTML(obj.thumbnail.replace(/&amp;/g, "&"));
                html += `
                        <div class="media-left">
                            <figure class="image is-96x96">
                                <a href="${redditUrl}" target="_blank" rel="noopener noreferrer" title="View on Reddit">
                                    <img src="${thumbUrl}" alt="Thumbnail" onerror="hideThumbnail(this)">
                                </a>
                            </figure>
                        </div>
                `;
            }

            html += `
                        <div class="media-content">
                            <p class="post-title">
                                <a href="${redditUrl}" target="_blank" rel="noopener noreferrer" class="has-text-light has-text-weight-bold">${escapeHTML(obj.title)}</a>
                            </p>
            `;

            if (!obj.is_self) {  // Link Post
                const escapedUrl = escapeHTML(obj.url);
                html += `
                            <p class="expand wrap">
                                <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" title="View linked URL" class="has-text-danger">${escapedUrl}</a>
                            </p>
                        </div>
                    </div>
                `;
            } else {  // Self Post
                html += `
                        </div>
                    </div>
                    ${formattedSelftext ? `<div class="content mb-3 markdown expand wrap">${formattedSelftext}</div>` : ""}
                `;
            }
        }

        html += `
                    <div class="card-footer-action is-size-7 mt-3">
                        <a href="${redditUrl}" target="_blank" rel="noopener noreferrer" class="has-text-grey-light">View on Reddit</a>
                    </div>
                </div>
            </div>
        `;

    });

    if (hasMore && count > 0 && until != null && until < 2147483647) {
        html += `
            <button type="submit" class="button is-danger is-fullwidth my-5" 
            id="fetch-${until}" data-umami-event="more-button" onclick="fetchMore(${until})">Fetch More</button>
        `;
    } else if (isEnd) {
        html += `
            <p class="has-text-centered has-text-grey my-5 is-size-7" id="endOfResults">End of Results</p>
        `;
    }

    return html;
}

function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const renderer = SnuOwnd.getRedditRenderer();
renderer.context.link_attributes = function(e, n, t) {
    e.s += ' target="_blank" rel="noopener noreferrer"';
};
const markdownParser = SnuOwnd.getParser(renderer, SnuOwnd.getParser().extensions | SnuOwnd.MKDEXT_FENCED_CODE);

function formatText(text, use_markdown) {
    if (!text) return "";
    if (use_markdown) {
        text = text.replace(/&amp;/g, "&");
        text = text.replace(/(^|\n)&gt; ?/g, "$1> ");
        text = markdownParser.render(text);

        // Link native Giphy embeds
        text = text.replace(/!\[gif\]\(giphy\|(\w+)[\|\w]*\)/g, (match, id) =>
            `<a href="https://media.giphy.com/media/${id}/giphy.gif" target="_blank" rel="noopener noreferrer">${match}</a>`
        );

        return text;
    } else {
        return escapeHTML(text).replaceAll("\n", "<br>");
    }
}

async function load(url, accessToken) {
    let headers = { headers: { "Authorization": `Bearer ${accessToken}` } };
    let response = await fetch(url, headers);
    return await response.json();
}

async function refreshToken(accessToken) {
    if (!accessToken || typeof accessToken !== "string") return null;
    const cleanToken = accessToken.replace(/['"]+/g, "").trim();
    const url = "https://auth.pushshift.io/refresh?access_token=" + encodeURIComponent(cleanToken);
    let newToken = null;
    try {
        const response = await fetch(url, { method: "POST" });
        const json = await response.json();
        if (response.ok && json && typeof json.access_token === "string") {
            newToken = json.access_token.replace(/['"]+/g, "").trim();
        } else {
            console.log(`HTTP ${response.status}: ${json ? json.detail : response.statusText}`);
        }
    } catch(e) {
        console.log(e);
    }
    return newToken;
}

function parseAccessTokenInput() {
    const text = form.elements['accessToken'].value;

    let accessToken;
    try {
        let json = JSON.parse(text);
        const type = Object.prototype.toString.call(json);
        if (type !== '[object Object]') {
            throw new Error("Not valid JSON object");
        }
        accessToken = json['access_token'] || json['accessToken'] || json['token'];
        if (!accessToken) {
            throw new Error("'access_token' missing from JSON");
        }
    } catch {
        accessToken = text;
    }

    try {
        accessToken = String(accessToken).replace(/['"]+/g, "").trim();
        if (accessToken.startsWith("Bearer ")) {
            accessToken = accessToken.slice(7).trim();
        }
    } catch {}

    form.elements['accessToken'].value = accessToken;
    return accessToken;
}

function directExpand(button) {
    let link = button.previousElementSibling;
    let url = link.href;
    if (button.classList.contains("closed")) {
        let span = document.createElement("span");
        span.style.display = "block";
        if (url.includes(".gifv") || url.includes(".mp4")) { // Video
            url = url.replace("gifv", "mp4");
            let video = document.createElement("video");
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            let source = document.createElement("source");
            source.src = url;
            source.type = "video/mp4";
            video.appendChild(source);
            span.appendChild(video);
        } else { // Image
            url = url.replace("preview.redd.it", "i.redd.it");
            let img = document.createElement("img");
            img.src = url;
            span.appendChild(img);
        }
        button.after(span);
    } else {
        let span = button.nextElementSibling;
        span.remove();
    }
    button.classList.toggle("closed");
}

function hideThumbnail(element) {
    let thumbnail = element.closest('.media-left');
    thumbnail.style.display = 'none';
}

function trackEvent(eventName, eventData) {
    try {
        if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
            window.umami.track(eventName, eventData);
        }
    } catch {}
}
