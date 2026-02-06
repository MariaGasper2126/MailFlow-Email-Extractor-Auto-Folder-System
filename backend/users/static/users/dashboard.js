document.addEventListener("DOMContentLoaded", () => {

    const createFolderBtn = document.getElementById("createFolderBtn");
    const folderModal = document.getElementById("folderModal");
    const closeModal = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const createFolderForm = document.getElementById("createFolderForm");
    const createBtn = document.getElementById("createBtn");

    // Open modal
    createFolderBtn.addEventListener("click", () => {
        folderModal.style.display = "flex";
        document.body.style.overflow = "hidden";
    });

    // Close modal
    function closeFolderModal() {
        folderModal.style.display = "none";
        document.body.style.overflow = "auto";
    }

    closeModal.addEventListener("click", closeFolderModal);
    cancelBtn.addEventListener("click", closeFolderModal);

    // Create folder (BACKEND)
    createFolderForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const folderName = document.getElementById("folderName").value.trim();

        if (!folderName) {
            alert("Folder name is required");
            return;
        }

        createBtn.disabled = true;

        try {
            const response = await fetch("/users/create-folder/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                },
                body: JSON.stringify({
                    folder_name: folderName
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed");
            }

            // ✅ reload to fetch folders from DB
            window.location.reload();

        } catch (error) {
            alert("Failed to create folder");
        } finally {
            createBtn.disabled = false;
        }
    });
    // =============================
    // DIRECT ICONS → RENAME / DELETE FOLDER
    // =============================


    const folderList = document.getElementById("folderList");

    folderList.addEventListener("click", async (e) => {
        // Debugging logs
        console.log("Clicked element:", e.target);
        console.log("Is Rename?", e.target.closest(".rename-btn"));
        console.log("Is Delete?", e.target.closest(".delete-btn"));

        // Prevent triggering the folder selection if we click an action button
        if (e.target.closest(".rename-btn")) {
            e.preventDefault(); // Safety
            e.stopPropagation();
            handleRename(e.target.closest(".folder-item"));
        } else if (e.target.closest(".delete-btn")) {
            e.preventDefault(); // Safety
            e.stopPropagation();
            handleDelete(e.target.closest(".folder-item"));
        }
    });

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
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                },
                body: JSON.stringify({ name: newName })
            });

            if (response.ok) {
                nameSpan.textContent = newName;
            } else {
                alert("Failed to rename folder");
            }
        } catch (error) {
            alert("Error renaming folder");
        }
    }

    async function handleDelete(folderItem) {
        if (!folderItem) return;
        const folderId = folderItem.dataset.id;

        // Exact message user requested
        const confirmDelete = confirm("When you delete a folder all the files inside the folder will also be deleted");

        if (!confirmDelete) return;

        try {
            const response = await fetch(`/users/delete-folder/${folderId}/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                }
            });

            if (response.ok) {
                folderItem.remove();
                // Optional: alert("Folder deleted successfully"); 
            } else {
                const error = await response.json();
                alert(error.error || "Failed to delete folder");
            }
        } catch (error) {
            alert("Error deleting folder");
        }
    }



    // =============================
    // USER PROFILE DROPDOWN
    // =============================
    const userProfile = document.getElementById("userProfile");
    const profileDropdown = document.getElementById("profileDropdown");

    if (userProfile && profileDropdown) {
        userProfile.addEventListener("click", (e) => {
            e.stopPropagation();
            profileDropdown.style.display = profileDropdown.style.display === "block" ? "none" : "block";
        });

        // Close dropdown when clicking outside
        window.addEventListener("click", () => {
            profileDropdown.style.display = "none";
        });

        profileDropdown.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }

    // =============================
    // LOGOUT MODAL & LOGIC
    // =============================
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutModal = document.getElementById("logoutModal");
    const cancelLogout = document.getElementById("cancelLogout");
    const confirmLogout = document.getElementById("confirmLogout");

    if (logoutBtn && logoutModal) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            // Close dropdown first
            if (profileDropdown) profileDropdown.style.display = "none";
            // Show modal
            logoutModal.style.display = "flex";
        });
    }

    if (cancelLogout && logoutModal) {
        cancelLogout.addEventListener("click", () => {
            logoutModal.style.display = "none";
        });
    }

    if (confirmLogout) {
        confirmLogout.addEventListener("click", async () => {
            try {
                const response = await fetch("/users/logout/", {
                    method: "POST", // or GET depending on your view. POST is safer.
                    headers: {
                        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")?.value || ""
                    }
                });

                if (response.ok) {
                    window.location.href = "/users/login/";
                } else {
                    alert("Logout failed");
                }
            } catch (error) {
                console.error("Logout error:", error);
                // Fallback redirect even if fetch fails
                window.location.href = "/users/login/";
            }
        });
    }

});
