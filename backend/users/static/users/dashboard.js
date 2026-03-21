let reloadAfterMessage = false;
let openModalAfterMessage = null;

function showMessageModal(message, title = 'Notification', reload = false, nextModalId = null) {
    document.getElementById('messageModalText').innerText = message;

    let icon = 'fa-info-circle';
    if (title.toLowerCase().includes('success')) icon = 'fa-check-circle';
    else if (title.toLowerCase().includes('error') || title.toLowerCase().includes('failed') || title.toLowerCase().includes('invalid')) icon = 'fa-exclamation-triangle';

    document.getElementById('messageModalTitle').innerHTML = '<i class="fas ' + icon + '"></i> ' + title;
    reloadAfterMessage = reload;
    openModalAfterMessage = nextModalId;
    document.getElementById('messageModal').style.display = 'flex';
}

function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
    if (reloadAfterMessage) {
        location.reload();
    } else if (openModalAfterMessage) {
        document.getElementById(openModalAfterMessage).style.display = 'flex';
        openModalAfterMessage = null;
    }
}
window.closeMessageModal = closeMessageModal;

function closePreviewModal() {
    document.getElementById('previewModal').style.display = 'none';
    document.getElementById('previewBody').innerHTML = '<div class="preview-loader"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    document.body.style.overflow = 'auto';
}
window.closePreviewModal = closePreviewModal;

function appAlert(message) {
    let title = 'Notification';
    if (typeof message !== 'string') message = String(message);
    let msgLower = message.toLowerCase();

    let isSuccess = msgLower.includes('success');
    let isError = msgLower.includes('error') || msgLower.includes('fail') || msgLower.includes('invalid') || msgLower.includes('incorrect');

    if (isSuccess) title = 'Success';
    else if (isError) title = 'Error';

    showMessageModal(message, title);
}

let fileIdToDelete = null;
let currentOpenedFolderId = null;
let currentOpenedFolderName = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initial Storage Bar Load
    const storageBar = document.querySelector(".storage-progress");
    if (storageBar) {
        const width = storageBar.getAttribute("data-width");
        setTimeout(() => {
            storageBar.style.width = width + "%";
        }, 300);
    }

    // Deletion Modal Events
    const confirmDeleteModal = document.getElementById("confirmDeleteModal");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const closeDeleteModal = document.getElementById("closeDeleteModal");

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            if (fileIdToDelete) {
                confirmDeleteModal.style.display = "none";
                await deleteFile(fileIdToDelete);
                fileIdToDelete = null;
            }
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener("click", () => {
            confirmDeleteModal.style.display = "none";
            fileIdToDelete = null;
        });
    }

    if (closeDeleteModal) {
        closeDeleteModal.addEventListener("click", () => {
            confirmDeleteModal.style.display = "none";
            fileIdToDelete = null;
        });
    }

    const createFolderBtn = document.getElementById("createFolderBtn");
    const folderModal = document.getElementById("folderModal");
    const closeModal = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const createFolderForm = document.getElementById("createFolderForm");
    const createBtn = document.getElementById("createBtn");

    // =============================
    // EXTRACT EMAILS BUTTON
    // =============================
    const extractBtn = document.getElementById("extractBtn");

    if (extractBtn) {
        extractBtn.addEventListener("click", async () => {
            const originalContent = extractBtn.innerHTML;

            // Set loading state
            extractBtn.disabled = true;
            extractBtn.classList.add("loading");
            extractBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting...';

            try {
                const response = await fetch("/users/extract/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                    }
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    const msg = `Extraction completed!\n\nEmails Processed: ${data.emails_processed}\nAttachments Saved: ${data.attachments_saved}`;
                    showMessageModal(msg, "Success", true);
                } else {
                    appAlert(data.error || "Extraction failed");
                }

            } catch (error) {
                console.error("Extraction error:", error);
                appAlert("Error during extraction");
            } finally {
                // Restore button state
                extractBtn.disabled = false;
                extractBtn.classList.remove("loading");
                extractBtn.innerHTML = originalContent;
            }
        });
    }


    // =============================
    // FOLDER MODAL OPEN / CLOSE
    // =============================

    if (createFolderBtn) {
        createFolderBtn.addEventListener("click", () => {
            folderModal.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
    }

    function closeFolderModal() {
        folderModal.style.display = "none";
        document.body.style.overflow = "auto";
    }

    if (closeModal) closeModal.addEventListener("click", closeFolderModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeFolderModal);

    // =============================
    // CREATE FOLDER
    // =============================

    if (createFolderForm) {
        createFolderForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const folderName = document.getElementById("folderName").value.trim();
            const domain = document.getElementById("domainName").value.trim();
            const senderEmail = document.getElementById("senderEmail").value.trim();
            const fileType = document.getElementById("fileType").value;

            if (!folderName) {
                appAlert("Folder name is required");
                return;
            }

            createBtn.disabled = true;

            try {
                const response = await fetch("/users/create-folder/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                    },
                    body: JSON.stringify({
                        folder_name: folderName,
                        domain: domain,
                        sender_email: senderEmail,
                        file_type: fileType
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed");
                }

                showMessageModal("Folder created successfully", "Success", true);

            } catch (error) {
                appAlert("Failed to create folder");
            } finally {
                createBtn.disabled = false;
            }
        });
    }

    // =============================
    // RENAME / DELETE FOLDER
    // =============================

    const folderList = document.getElementById("folderList");

    if (folderList) {
        folderList.addEventListener("click", async (e) => {

            if (e.target.closest(".rename-btn")) {
                e.preventDefault();
                e.stopPropagation();
                handleRename(e.target.closest(".folder-item"));
            } else if (e.target.closest(".delete-btn")) {
                e.preventDefault();
                e.stopPropagation();
                handleDelete(e.target.closest(".folder-item"));
            }
            else if (e.target.closest(".folder-item")) {
                const folderItem = e.target.closest(".folder-item");
                const folderId = folderItem.dataset.id;
                const folderName = folderItem.querySelector(".folder-name").textContent.trim();

                loadFolderFiles(folderId, folderName);
            }
        });
    }

    async function handleRename(folderItem) {
        if (!folderItem) return;

        const folderId = folderItem.dataset.id;
        const nameSpan = folderItem.querySelector(".folder-name");
        const currentName = nameSpan.textContent.trim();

        const newName = prompt("Enter new folder name:", currentName);
        if (!newName || newName === currentName) return;

        try {
            const response = await fetch(`/users/rename-folder/${folderId}/`, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                },
                body: JSON.stringify({ name: newName })
            });

            if (response.ok) {
                nameSpan.textContent = newName;
            } else {
                appAlert("Failed to rename folder");
            }
        } catch (error) {
            appAlert("Error renaming folder");
        }
    }

    async function handleDelete(folderItem) {
        if (!folderItem) return;

        const folderId = folderItem.dataset.id;
        const confirmDelete = confirm("When you delete a folder all the files inside the folder will also be deleted");

        if (!confirmDelete) return;

        try {
            const response = await fetch(`/users/delete-folder/${folderId}/`, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                }
            });

            if (response.ok) {
                folderItem.remove();
            } else {
                appAlert("Failed to delete folder");
            }
        } catch (error) {
            appAlert("Error deleting folder");
        }
    }

    // =============================
    // USER DROPDOWN
    // =============================

    const userProfile = document.getElementById("userProfile");
    const profileDropdown = document.getElementById("profileDropdown");

    if (userProfile && profileDropdown) {
        userProfile.addEventListener("click", (e) => {
            e.stopPropagation();
            profileDropdown.style.display =
                profileDropdown.style.display === "block" ? "none" : "block";
        });

        window.addEventListener("click", () => {
            profileDropdown.style.display = "none";
        });

        profileDropdown.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }

    // =============================
    // LOGOUT
    // =============================
    // LOGOUT MODAL OPEN
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutModal = document.getElementById("logoutModal");
    const cancelLogout = document.getElementById("cancelLogout");

    if (logoutBtn && logoutModal) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            logoutModal.style.display = "flex";
        });
    }

    if (cancelLogout && logoutModal) {
        cancelLogout.addEventListener("click", function () {
            logoutModal.style.display = "none";
        });
    }
    // =============================
    // PASSKEY GAUGE LOGIC
    // =============================

    const gauge = document.querySelector(".passkey-gauge");
    const daysText = document.querySelector(".passkey-days");
    const statusText = document.querySelector(".passkey-status");


    if (gauge && daysText && statusText) {

        const daysRemaining = parseInt(daysText.dataset.days);
        const maxDays = 14;

        daysText.innerText = daysRemaining + " days";
        const percentage = daysRemaining / maxDays;

        const minAngle = -80;
        const maxAngle = 80;

        const angle = minAngle + (percentage * (maxAngle - minAngle));

        setTimeout(() => {
            gauge.style.setProperty("--needle-angle", angle + "deg");
        }, 100);

        if (daysRemaining > 7) {
            daysText.style.color = "#34a853";
            statusText.innerText = "Secure";
            statusText.style.color = "#34a853";
        }
        else {
            daysText.style.color = "#ea4335";
            statusText.innerText = "About to expire";
            statusText.style.color = "#ea4335";
        }

    }


    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'pdf': return 'fa-file-pdf';
            case 'png':
            case 'jpg':
            case 'jpeg':
                return 'fa-file-image';
            case 'doc':
            case 'docx':
                return 'fa-file-word';
            case 'xls':
            case 'xlsx':
                return 'fa-file-excel';
            case 'ppt':
            case 'pptx':
                return 'fa-file-powerpoint';
            case 'txt':
                return 'fa-file-alt';
            default:
                return 'fa-file';
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function renderFilesList(files, container) {
        container.innerHTML = '';

        if (files.length === 0) {
            container.innerHTML = "<p class='no-files'>No files found</p>";
            return;
        }

        files.forEach(file => {
            const extension = file.name.split('.').pop().toUpperCase();
            const iconClass = getFileIcon(file.name);
            container.innerHTML += `
            <div class="file-card">
                <i class="fas ${iconClass}" style="font-size: 24px;"></i>
                <div class="file-info">
                    <span class="file-name">${file.name} (${extension})</span>
                    <small class="file-date">${file.date}</small>
                    <small class="file-sender">From: ${file.sender}</small>
                    <small class="file-size">${formatFileSize(file.size)}</small>
                    <div class="file-actions" style="margin-top: 8px; display: flex; gap: 15px;">
                        <a href="#" class="preview-btn" data-id="${file.id}" data-name="${file.name}" style="text-decoration: none; color: var(--primary); font-size: 13px; font-weight: 500;">
                            <i class="fas fa-eye"></i> Preview
                        </a>
                        <a href="#" class="download-btn" data-id="${file.id}" style="text-decoration: none; color: var(--primary); font-size: 13px; font-weight: 500;">
                            <i class="fas fa-download"></i> Download
                        </a>
                        <a href="#" class="delete-btn" data-id="${file.id}" style="text-decoration: none; color: #e53e3e; font-size: 13px; font-weight: 500;">
                            <i class="fas fa-trash-alt"></i> Delete
                        </a>
                    </div>
                </div>
            </div>
        `;
        });

        // Attach passkey verification events
        document.querySelectorAll(".preview-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const fileId = btn.getAttribute("data-id");
                const fileName = btn.getAttribute("data-name");
                verifyPasskeyAndOpen(fileId, "preview", fileName);
            });
        });

        document.querySelectorAll(".download-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const fileId = btn.getAttribute("data-id");
                verifyPasskeyAndOpen(fileId, "download");
            });
        });

        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                fileIdToDelete = btn.getAttribute("data-id");
                document.getElementById("confirmDeleteModal").style.display = "flex";
            });
        });
    }

    async function deleteFile(fileId) {
        try {
            const response = await fetch(`/users/delete-attachment/${fileId}/`, {
                method: "POST",
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                }
            });
            const data = await response.json();
            if (data.success) {
                // 1. Immediately remove from DOM for "instant" feel
                const btn = document.querySelector(`.delete-btn[data-id="${fileId}"]`);
                if (btn) {
                    const card = btn.closest('.file-card');
                    if (card) {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        setTimeout(() => card.remove(), 200);
                    }
                }

                // 2. Refresh the actual data in background
                if (currentOpenedFolderId) {
                    await loadFolderFiles(currentOpenedFolderId, currentOpenedFolderName);
                }

                appAlert("File deleted successfully");
            } else {
                appAlert(data.error || "Failed to delete file");
            }
        } catch (error) {
            console.error("Delete error:", error);
            appAlert("Error during file deletion");
        }
    }

    async function loadFolderFiles(folderId, folderName) {
        currentOpenedFolderId = folderId;
        currentOpenedFolderName = folderName;
        try {
            const response = await fetch(`/users/folder/${folderId}/attachments/`);
            const data = await response.json();

            if (!data.success) {
                appAlert("Failed to load files");
                return;
            }

            const mainContent = document.querySelector(".main-content");
            let allFiles = data.files;

            mainContent.innerHTML = `
    <div class="files-container">
        <h2 class="files-title">${folderName || 'Files'}</h2>
        <div class="folder-rule"></div>
        <div class="files-toolbar">
            <!-- Hidden fake input to catch browser auto-fill -->
            <input type="text" style="display:none;" />
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="fileSearchInput" placeholder="Search files..." autocomplete="one-time-code" readonly onfocus="this.removeAttribute('readonly');" />
            </div>
            <div class="sort-box">
                <label for="fileSortSelect"><i class="fas fa-sort"></i></label>
                <select id="fileSortSelect">
                    <option value="date-desc">Date (Newest)</option>
                    <option value="date-asc">Date (Oldest)</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="size-desc">Size (Largest)</option>
                    <option value="size-asc">Size (Smallest)</option>
                </select>
            </div>
            </div>
        </div>
        <div class="files-list"></div>
    </div>
`;

            const filesList = mainContent.querySelector(".files-list");
            const ruleDiv = mainContent.querySelector(".folder-rule");
            const searchInput = document.getElementById("fileSearchInput");
            const sortSelect = document.getElementById("fileSortSelect");

            // Forcefully clear any auto-filled value
            setTimeout(() => {
                if (searchInput) searchInput.value = "";
            }, 50);

            if (data.rule) {
                ruleDiv.innerHTML = `
                <div class="rule-box">
                    <strong>Rule Applied:</strong><br>
                    Sender: ${data.rule.sender_email || "Any"}<br>
                    Domain: ${data.rule.domain || "Any"}<br>
                    File Type: ${data.rule.file_type || "Any"}
                </div>
            `;
            }

            function getFilteredSortedFiles() {
                const query = searchInput.value.toLowerCase();
                const sortVal = sortSelect.value;

                let filtered = allFiles.filter(f => f.name.toLowerCase().includes(query));

                filtered.sort((a, b) => {
                    switch (sortVal) {
                        case 'date-desc': return new Date(b.date_raw) - new Date(a.date_raw);
                        case 'date-asc': return new Date(a.date_raw) - new Date(b.date_raw);
                        case 'name-asc': return a.name.localeCompare(b.name);
                        case 'name-desc': return b.name.localeCompare(a.name);
                        case 'size-desc': return b.size - a.size;
                        case 'size-asc': return a.size - b.size;
                        default: return 0;
                    }
                });

                return filtered;
            }

            function updateDisplay() {
                renderFilesList(getFilteredSortedFiles(), filesList);
            }

            searchInput.addEventListener("input", updateDisplay);
            sortSelect.addEventListener("change", updateDisplay);

            // Initial render
            updateDisplay();

        } catch (error) {
            appAlert("Error loading files");
        }
    }
    let currentFileIdForPasskey = null;
    let currentActionTypeForPasskey = null;

    async function verifyPasskeyAndOpen(fileId, type, fileName = "") {
        currentFileIdForPasskey = fileId;
        currentActionTypeForPasskey = type;
        const currentFileName = fileName; // Store for preview check
        document.getElementById("verifyPasskeyInput").value = "";
        
        // Ensure passkey modal is ABOVE preview modal
        const passkeyModal = document.getElementById("verifyPasskeyModal");
        passkeyModal.style.zIndex = "20000"; 
        passkeyModal.style.display = "flex";
        
        // Temporarily store name to pass to opener
        passkeyModal.dataset.filename = fileName;
    }
    window.verifyPasskeyAndOpen = verifyPasskeyAndOpen;

    const submitVerifyPasskeyBtn = document.getElementById("submitVerifyPasskeyBtn");

    if (submitVerifyPasskeyBtn) {
        submitVerifyPasskeyBtn.addEventListener("click", async () => {
            const passkey = document.getElementById("verifyPasskeyInput").value;

            if (!passkey) return;

            if (passkey.length < 4) {
                appAlert("Passkey must be at least 4 characters.");
                return;
            }

            try {

                const response = await fetch("/users/verify-passkey/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                    },
                    body: JSON.stringify({ passkey: passkey })
                });

                const data = await response.json();

                if (data.success === true || data.success === "true") {

                    document.getElementById("verifyPasskeyModal").style.display = "none";

                    if (currentActionTypeForPasskey === "preview") {
                        const fileName = document.getElementById("verifyPasskeyModal").dataset.filename || "";
                        openPreviewModal(currentFileIdForPasskey, fileName);
                    }

                    if (currentActionTypeForPasskey === "download") {
                        window.location.href = `/users/download/${currentFileIdForPasskey}/`;
                    }

                } else {
                    appAlert(data.error || "Incorrect passkey");
                }

            } catch (error) {
                appAlert("Passkey verification failed");
            }
        });
    }

    // =============================
    // SET / RESET PASSKEY
    // =============================

    const setPasskeyBtn = document.getElementById("setPasskeyBtn");

    if (setPasskeyBtn) {

        setPasskeyBtn.addEventListener("click", async () => {

            try {

                // STEP 1: send OTP
                const sendOtp = await fetch("/users/send-passkey-otp/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                    }
                });

                const otpData = await sendOtp.json();

                if (!otpData.success) {
                    appAlert("Failed to send OTP");
                    return;
                }

                showMessageModal("OTP sent to your email", "Success", false, "otpModal");
            } catch (error) {

                appAlert("Error sending OTP");

            }

        });

    }
    // =============================
    // VERIFY OTP
    // =============================

    // OTP Modal close buttons
    const closeOtpModal = document.getElementById("closeOtpModal");
    const cancelOtpBtn = document.getElementById("cancelOtpBtn");

    if (closeOtpModal) {
        closeOtpModal.addEventListener("click", () => {
            document.getElementById("otpModal").style.display = "none";
        });
    }

    if (cancelOtpBtn) {
        cancelOtpBtn.addEventListener("click", () => {
            document.getElementById("otpModal").style.display = "none";
        });
    }

    const verifyOtpBtn = document.getElementById("verifyOtpBtn");

    if (verifyOtpBtn) {

        verifyOtpBtn.addEventListener("click", async () => {

            const otp = document.getElementById("otpInput").value;

            if (!otp) {
                appAlert("Enter OTP");
                return;
            }

            try {

                const response = await fetch("/users/verify-passkey-otp/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                    },
                    body: JSON.stringify({ otp: otp })
                });

                const data = await response.json();

                if (data.success) {

                    document.getElementById("otpModal").style.display = "none";
                    document.getElementById("passkeyModal").style.display = "flex";

                } else {

                    appAlert(data.error || "Invalid OTP");

                }

            } catch (error) {

                console.error(error);
                appAlert("Server error during OTP verification");

            }

        });

    }

    // =============================
    // SAVE PASSKEY
    // =============================

    const savePasskeyBtn = document.getElementById("savePasskeyBtn");

    if (savePasskeyBtn) {

        savePasskeyBtn.addEventListener("click", async () => {

            const passkey = document.getElementById("newPasskeyInput").value;

            if (!passkey) {
                appAlert("Enter passkey");
                return;
            }

            try {

                const response = await fetch("/users/set-passkey/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                    },
                    body: JSON.stringify({ passkey: passkey })
                });

                const data = await response.json();

                if (data.success) {

                    showMessageModal("Passkey updated successfully", "Success", true);
                    document.getElementById("passkeyModal").style.display = "none";

                } else {

                    appAlert(data.error || "Failed to set passkey");

                }

            } catch (error) {

                appAlert("Error setting passkey");

            }

        });

    }
});

async function openPreviewModal(fileId, fileName = "") {
    const previewModal = document.getElementById("previewModal");
    const previewBody = document.getElementById("previewBody");

    previewModal.style.display = "flex";
    document.body.style.overflow = "hidden";

    try {
        const ext = fileName.split('.').pop().toLowerCase();
        const previewUrl = `/users/preview/${fileId}/#toolbar=0`;
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            // Image Preview (Better than iframe)
            previewBody.innerHTML = `
                <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding: 20px;">
                    <img src="${previewUrl}" alt="${fileName}" style="max-width:100%; max-height:100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); opacity:0; transition: opacity 0.5s;" onload="this.style.opacity=1">
                </div>
            `;
        } else if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
            // Fallback for Office files
            previewBody.innerHTML = `
                <div style="text-align:center; padding: 40px; color: #333;">
                    <i class="fas fa-file-invoice" style="font-size: 64px; color: var(--primary); margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 10px;">Preview Not Available</h3>
                    <p style="margin-bottom: 25px;">The format <strong>.${ext.toUpperCase()}</strong> cannot be previewed directly in the browser.</p>
                    <button onclick="verifyPasskeyAndOpen('${fileId}', 'download')" class="btn btn-primary" style="background: var(--primary); color: white; padding: 12px 25px; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 10px;">
                        <i class="fas fa-download"></i> Download and View File
                    </button>
                </div>
            `;
        } else {
            // Default Frame (PDF, TXT, etc)
            previewBody.innerHTML = `
                <iframe src="${previewUrl}" title="File Preview" onload="this.style.opacity=1" style="width:100%; height:100%; border:none; border-radius: 8px; opacity:0; transition: opacity 0.5s;"></iframe>
            `;
        }
    } catch (error) {
        previewBody.innerHTML = '<p style="color:white; padding: 20px;">Failed to load preview.</p>';
    }
}