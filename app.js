const planStorageKey = "flockAndFeedPlan";
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const rootElement = document.documentElement;
const themeColor = document.querySelector('meta[name="theme-color"]');

function setTheme(theme) {
    rootElement.dataset.theme = theme;
    try {
        localStorage.setItem("flockAndFeedTheme", theme);
    } catch {
        // The selected theme still applies for this page when storage is unavailable.
    }
    if (themeColor) themeColor.content = theme === "dark" ? "#1c2822" : "#f4f4ed";
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
        button.textContent = theme === "dark" ? "Light mode" : "Dark mode";
        button.setAttribute("aria-pressed", String(theme === "dark"));
    }
}

let preferredTheme = "light";
try {
    preferredTheme = localStorage.getItem("flockAndFeedTheme") || "light";
} catch {
    preferredTheme = "light";
}
setTheme(preferredTheme);

for (const button of document.querySelectorAll("[data-theme-toggle]")) {
    button.addEventListener("click", () => {
        const nextTheme = rootElement.dataset.theme === "dark" ? "light" : "dark";
        try {
            setTheme(nextTheme);
        } catch {
            rootElement.dataset.theme = nextTheme;
        }
    });
}

let installPrompt;
const installButton = document.querySelector("[data-install-app]");
window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
});

if (installButton) {
    installButton.addEventListener("click", async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        installButton.hidden = true;
    });
}

if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

function readPlan() {
    try {
        const storedPlan = JSON.parse(localStorage.getItem(planStorageKey));
        if (
            storedPlan &&
            Number.isFinite(storedPlan.birdCount) && storedPlan.birdCount > 0 &&
            Number.isFinite(storedPlan.portionGrams) && storedPlan.portionGrams > 0 &&
            Number.isFinite(storedPlan.feedingsPerDay) && storedPlan.feedingsPerDay > 0
        ) return storedPlan;
    } catch {
        return null;
    }
    return null;
}

function formatNumber(value) {
    return numberFormat.format(value);
}

function updatePlanViews(plan) {
    if (!plan) return;

    const perBird = plan.portionGrams / plan.birdCount;
    const dailyTotal = plan.portionGrams * plan.feedingsPerDay;
    const values = {
        "[data-dashboard-birds]": formatNumber(plan.birdCount),
        "[data-dashboard-poultry]": formatNumber(plan.birdCount),
        "[data-dashboard-portion]": formatNumber(plan.portionGrams),
        "[data-dashboard-daily]": formatNumber(dailyTotal),
        "[data-plan-seed]": plan.seedType,
        "[data-plan-portion]": formatNumber(plan.portionGrams),
        "[data-plan-birds]": formatNumber(plan.birdCount),
        "[data-plan-servings]": formatNumber(plan.feedingsPerDay),
        "[data-plan-per-bird]": formatNumber(perBird),
        "[data-plan-daily]": formatNumber(dailyTotal),
        "[data-result-portion]": formatNumber(plan.portionGrams),
        "[data-result-seed]": plan.seedType,
        "[data-result-per-bird]": formatNumber(perBird),
        "[data-result-daily]": formatNumber(dailyTotal)
    };

    for (const [selector, value] of Object.entries(values)) {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    }

    const emptyPlan = document.querySelector("[data-plan-empty]");
    const savedPlan = document.querySelector("[data-plan-content]");
    if (emptyPlan && savedPlan) {
        emptyPlan.hidden = true;
        savedPlan.hidden = false;
    }

    const emptyCalculation = document.querySelector("[data-calculation-empty]");
    const calculationResults = document.querySelector("[data-calculation-results]");
    if (emptyCalculation && calculationResults) {
        emptyCalculation.hidden = true;
        calculationResults.hidden = false;
    }
}

const savedPlan = readPlan();
updatePlanViews(savedPlan);

const calculator = document.querySelector("#feed-calculator");
if (calculator) {
    const gramsInput = calculator.elements.portionGrams;
    const dispenseButton = document.querySelector("#dispense-seed");
    const dispenseAmount = document.querySelector("[data-dispense-amount]");
    const connectButton = document.querySelector("#connect-machine");
    const machineMessage = document.querySelector("[data-machine-message]");
    const machineIndicator = document.querySelector("[data-machine-indicator]");
    let machineConnected = false;

    function updateDispenseButton() {
        const grams = Number(gramsInput.value);
        if (dispenseAmount) dispenseAmount.textContent = `${formatNumber(grams || 0)} g`;
        if (dispenseButton) dispenseButton.disabled = !machineConnected || !gramsInput.validity.valid;
    }

    function setMachineStatus(connected, message) {
        machineConnected = connected;
        if (machineMessage) machineMessage.textContent = message;
        if (machineIndicator) machineIndicator.classList.toggle("is-connected", connected);
        updateDispenseButton();
    }

    gramsInput.addEventListener("input", updateDispenseButton);

    if (connectButton) {
        connectButton.addEventListener("click", async () => {
            connectButton.disabled = true;
            setMachineStatus(false, "Checking machine connection...");
            try {
                const response = await fetch("/api/status", { cache: "no-store" });
                if (!response.ok) throw new Error("Machine status is unavailable");
                const status = await response.json();
                if (status.connected !== true) throw new Error("Machine did not confirm it is ready");
                setMachineStatus(true, "Machine connected and ready");
            } catch {
                setMachineStatus(false, "Machine controller is unavailable");
            } finally {
                connectButton.disabled = false;
            }
        });
    }

    if (dispenseButton) {
        dispenseButton.addEventListener("click", async () => {
            const grams = Number(gramsInput.value);
            if (!machineConnected || !gramsInput.validity.valid) return;
            const seedType = calculator.elements.seedType.value;
            if (!window.confirm(`Dispense ${formatNumber(grams)} g of ${seedType}?`)) return;

            dispenseButton.disabled = true;
            setMachineStatus(true, "Sending dispense request...");
            try {
                const response = await fetch("/api/dispense", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ grams, seedType })
                });
                const result = await response.json();
                if (!response.ok || result.accepted !== true) throw new Error("Machine did not accept the request");
                setMachineStatus(true, "Request accepted by machine");
            } catch {
                setMachineStatus(false, "Dispense failed; check the machine connection");
            }
        });
    }

    if (savedPlan) {
        calculator.elements.seedType.value = savedPlan.seedType;
        calculator.elements.birdCount.value = savedPlan.birdCount;
        calculator.elements.portionGrams.value = savedPlan.portionGrams;
        calculator.elements.feedingsPerDay.value = savedPlan.feedingsPerDay;
        updateDispenseButton();
    }

    calculator.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!calculator.reportValidity()) return;

        const formData = new FormData(calculator);
        const plan = {
            seedType: String(formData.get("seedType")),
            birdCount: Number(formData.get("birdCount")),
            portionGrams: Number(formData.get("portionGrams")),
            feedingsPerDay: Number(formData.get("feedingsPerDay"))
        };

        try {
            localStorage.setItem(planStorageKey, JSON.stringify(plan));
        } catch {
            const savedMessage = document.querySelector("[data-saved-message]");
            if (savedMessage) {
                savedMessage.textContent = "Could not save on this device. Your totals are still shown.";
                savedMessage.hidden = false;
            }
        }

        updatePlanViews(plan);
        const savedMessage = document.querySelector("[data-saved-message]");
        if (savedMessage) savedMessage.hidden = false;
    });
}