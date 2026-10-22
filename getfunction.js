
import supabaseClient from "./supabase.js";

// Escape database values before inserting them into HTML.
function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Convert a public Google Drive sharing link into an image URL.

function getImageURL(url = "") {
    const value = String(url).trim();

    if (!value) return "";

    try {
        const parsedURL = new URL(value);

        // Handle public Google Drive image links.
        if (
            parsedURL.hostname === "drive.google.com" ||
            parsedURL.hostname === "www.drive.google.com"
        ) {
            let fileId = parsedURL.searchParams.get("id");

            // Handle links like /file/d/FILE_ID/view
            if (!fileId) {
                const match = parsedURL.pathname.match(
                    /\/file\/d\/([^/]+)/
                );

                fileId = match ? match[1] : null;
            }

            if (fileId) {
                return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
            }

            return "";
        }

        // Accept regular HTTPS image URLs.
        if (parsedURL.protocol === "https:") {
            return parsedURL.href;
        }

        return "";
    } catch {
        return "";
    }
}


// Preserve your existing CSS-generated project previews.
function createFallbackVisual(title, number) {
    const safeTitle = escapeHTML(title);
    const lowerTitle = String(title).toLowerCase();

    if (lowerTitle.includes("marketplace")) {
        return `
            <div class="project-visual project-one">
                <span>${number}</span>
                <div class="mock-window marketplace-window">
                    <div class="window-bar">
                        <i></i><i></i><i></i>
                    </div>
                    <strong>MARKETPLACE</strong>
                    <div class="product-row">
                        <b></b><b></b><b></b>
                    </div>
                    <small>Browse • Sell • Discover</small>
                </div>
            </div>
        `;
    }

    if (lowerTitle.includes("queue")) {
        return `
            <div class="project-visual project-two">
                <span>${number}</span>
                <div class="phone queue-phone">
                    <i></i>
                    <strong>QUEUE</strong>
                    <em>NOW SERVING</em>
                    <b>027</b>
                    <small>Estimated wait</small>
                    <div class="queue-line"></div>
                </div>
            </div>
        `;
    }

    if (
        lowerTitle.includes("ai") ||
        lowerTitle.includes("chatbot")
    ) {
        return `
            <div class="project-visual project-three">
                <span>${number}</span>
                <div class="chat-ui">
                    <strong>AI</strong>
                    <p>How can I help?</p>
                    <div></div><div></div><div></div>
                    <small>AI-powered interface</small>
                </div>
            </div>
        `;
    }

    return `
        <div class="project-visual project-default">
            <span>${number}</span>
            <div class="default-project-card">
                <div class="default-icon">↗</div>
                <strong>${safeTitle}</strong>
                <small>DIGITAL PROJECT</small>
            </div>
        </div>
    `;
}

async function loadProjects() {
    const projectsContainer = document.querySelector(".projects");

    if (!projectsContainer) {
        console.error("Projects container not found.");
        return;
    }

    projectsContainer.setAttribute("aria-busy", "true");

    try {
        const { data: projects, error } = await supabaseClient
            .from("projects")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!projects || projects.length === 0) {
            projectsContainer.innerHTML = `
                <p class="projects-message">
                    No projects available yet.
                </p>
            `;
            return;
        }

        projectsContainer.innerHTML = projects.map((project, index) => {
            const number = String(index + 1).padStart(2, "0");

            const title = escapeHTML(project.title || "Untitled Project");
            const description = escapeHTML(project.description || "");
            const imageURL = getImageURL(project.image);
            const githubURL = getSafeExternalURL(project.github);
            const demoURL = getSafeExternalURL(project.live_demo);

            // Keep the CSS preview underneath the real screenshot.
            const fallbackVisual = createFallbackVisual(
                project.title || "Untitled Project",
                number
            );

            const visual = imageURL
                ? `
                    <div class="project-image-wrapper">
                        ${fallbackVisual}
                        <img
                            class="project-screenshot"
                            src="${escapeHTML(imageURL)}"
                            alt="${title} project screenshot"
                            loading="lazy"
                            decoding="async"
                            referrerpolicy="no-referrer"
                        >
                    </div>
                `
                : fallbackVisual;

            const demoLink = demoURL
                ? `
                    <a
                        class="project-link"
                        href="${escapeHTML(demoURL)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View live demo of ${title}"
                    >
                        Live Demo <span aria-hidden="true">↗</span>
                    </a>
                `
                : "";

            const githubLink = githubURL
                ? `
                    <a
                        class="project-link github-link"
                        href="${escapeHTML(githubURL)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View ${title} source code on GitHub"
                    >
                        GitHub <span aria-hidden="true">↗</span>
                    </a>
                `
                : "";

            return `
                <article class="project reveal">
                    ${visual}

                    <div class="project-info">
                        <div>
                            <h3>${title}</h3>
                            <p>${description}</p>
                        </div>
                    </div>

                    <div class="project-actions">
                        ${demoLink}
                        ${githubLink}
                    </div>
                </article>
            `;
        }).join("");

        // If an image fails, reveal the existing CSS preview beneath it.
        projectsContainer.querySelectorAll(".project-screenshot").forEach(
            (img) => {
                const hideBrokenImage = () => {
                    img.style.display = "none";
                };

                img.addEventListener("error", hideBrokenImage, { once: true });

                // Also handle images that finished loading before this listener.
                if (img.complete && img.naturalWidth === 0) {
                    hideBrokenImage();
                }
            }
        );

    } catch (error) {
        console.error("Error loading projects:", error);

        projectsContainer.innerHTML = `
            <p class="projects-message">
                Unable to load projects right now. Please try again later.
            </p>
        `;
    } finally {
        projectsContainer.setAttribute("aria-busy", "false");
    }
}

function getSafeExternalURL(value) {
    if (!value) return "";

    try {
        const url = new URL(String(value).trim());

        if (url.protocol === "https:") {
            return url.href;
        }
    } catch {
        return "";
    }

    return "";
}

loadProjects();
