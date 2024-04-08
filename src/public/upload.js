const DONE_COLOR = "#00ff00";
const ERROR_COLOR = "red";

var pageElements = {
    fileName: document.querySelector('.preview-card div'),
    dropArea: document.querySelector('.drop-area'),
    paramMenu: document.querySelector('.inputs-container'),
    fileInput: document.querySelector('.file-input'),
    prevAndInputs: document.querySelector('.prev-and-inputs'),
    previewCard: document.querySelector('.preview-card'),
    previewImg: document.querySelector('.preview-card img'),
    statusLabel: document.querySelector('.status-text'),
    submitButton: document.querySelector('.submit-button'),
    base64Button: document.querySelector('.base64-button'),
    submitButtonCircle: document.querySelector('.submit-button .button-loading-circle'),
    base64ButtonCircle: document.querySelector('.base64-button .button-loading-circle'),
    paramForm: document.querySelector('.input-params')
}

for (let key in pageElements) {
    if (!pageElements[key]) {
        alert(`Page element ${key} not found!`);
        throw Error(`Page element ${key} not found!`);
    }
}

try {
    startPage();
} catch (err) {
    alert(`Exception when starting page:\n${err.message}`);
}

function startPage() {
    document.addEventListener('paste', async (event) => {
        var blob;
        try {
            let clipboardItems = await navigator.clipboard.read();
            console.log('DEBUG clip types:', clipboardItems[0].types)
            for (const imageType of clipboardItems[0].types) {
                blob = await clipboardItems[0].getType(imageType);
            }
        } catch (e) {
            return console.error("Clipboard inserting error!\n", e);
        }
        openPrevAndInputsForFile(blob);
    });

    document.addEventListener('dragover', (event) => {
        dragOverHover();
        event.preventDefault();
    });
    document.addEventListener('dragleave', (event) => {
        dragLeave();
        event.preventDefault();
    });
    document.addEventListener('drop', (event) => {
        console.log(123);
        pageElements.fileInput.files = event.dataTransfer.files;
        pageElements.fileInput.dispatchEvent(new Event('change'));
        event.preventDefault();
    });

    pageElements.fileInput.addEventListener('change', (event) => {
        if (event.target.files && event.target.files[0])
            openPrevAndInputsForFile(event.target.files[0])
    });

    hide(pageElements.prevAndInputs);
    hide(pageElements.submitButtonCircle);
    hide(pageElements.base64ButtonCircle);
}

/** @param {HTMLElement} element */
function hide(element) {
    if (!element.originalDisplay)
        element.originalDisplay = getComputedStyle(element).display;
    element.style.display = 'none';
}

/** @param {HTMLElement} element */
function show(element) {
    if (element.originalDisplay)
        element.style.display = element.originalDisplay;
}

function dragOverHover() {
    pageElements.dropArea.className = "drop-area dragover";
}

function dragLeave() {
    pageElements.dropArea.className = "drop-area";
}

/** @param {Blob} file */
function openPrevAndInputsForFile(file) {
    pageElements.fileName.innerHTML = '<b>' + pageElements.fileInput.value + '</b>';
    hide(pageElements.dropArea);
    show(pageElements.prevAndInputs);
    show(pageElements.paramMenu);

    if (file.type.includes("image")) {
        pageElements.previewImg.src = URL.createObjectURL(file);
    }
    else {
        pageElements.previewImg.src = "file.svg";
    }

    pageElements.submitButton.addEventListener('click', (event) => {
        submitPost(file).then();
    });

    pageElements.base64Button.addEventListener('click', (event) => {
        submitToBase64Url(file).then();
    });
}

/** @returns {HTMLElement} - status label */
function setStatusLabel(color, text) {
    pageElements.statusLabel.style['background-color'] = color;
    pageElements.statusLabel.innerText = text;

    return pageElements.statusLabel;
}

/** @returns {HTMLElement} - link element */
function replaceParamsWithDoneLink(text, href, linkText) {
    var label = setStatusLabel(DONE_COLOR, text);
    var linkElement = document.createElement("a");
    linkElement.href = href;
    linkElement.innerText = linkText;
    label.appendChild(linkElement);

    hide(pageElements.paramMenu);

    return linkElement;
}

function setWaitingStatus(waiterCircleElement, status) {
    status ? show(waiterCircleElement) : hide(waiterCircleElement);
    pageElements.submitButton.disabled = status;
    pageElements.base64Button.disabled = status;
}

/** @param {Blob} blob */
async function submitPost(blob) {
    var formData = new FormData(pageElements.paramForm);
    formData.append('file', blob);

    setWaitingStatus(pageElements.submitButtonCircle, true);

    try {
        var response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        var statusText = await response.text();

        if (response.status !== 200) {
            setStatusLabel(ERROR_COLOR, "Error! " + statusText);
        }
        else {
            var link = window.location.origin + statusText;
            replaceParamsWithDoneLink("Posted. URL: ", link, link);
        }
    } catch (err) {
        setStatusLabel(ERROR_COLOR, "Error! " + err.message);
    } finally {
        setWaitingStatus(pageElements.submitButtonCircle, false);
    }
}

/** @param {Blob} blob */
async function submitToBase64Url(blob) {
    var reader = new FileReader();
    reader.readAsDataURL(blob);

    setWaitingStatus(pageElements.base64ButtonCircle, true);

    await new Promise((res) => { reader.onload = res; });

    setWaitingStatus(pageElements.base64ButtonCircle, true);

    /** @type {string} */
    var url = reader.result;

    var linkHtml = replaceParamsWithDoneLink("Done!", "#", "Click here to copy URL");
    linkHtml.onclick = () => {
        navigator.clipboard.writeText(url);
        return false;
    }
}