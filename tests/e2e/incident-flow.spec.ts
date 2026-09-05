import { expect, test } from "@playwright/test";

test("operator traces a fault to a verified recovery", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByRole("heading", { name: "INC-204 · Checkout latency cascade" })).toBeVisible();
  await expect(page.getByText("No live systems, customer data, or external dependencies are connected.")).toBeVisible();
  await page.getByTestId("inject-fault-header").click();
  await expect(page.getByText("Correlated evidence")).toBeVisible();
  await page.getByTestId("begin-investigation").click();
  await page.getByTestId("root-hypothesis").click();
  await page.getByTestId("correct-action").click();
  await page.getByTestId("execute-action").click();
  await expect(page.getByTestId("recovery-verified")).toContainText("SLO back inside target");
});

test("wrong remediation visibly fails and preserves the incident", async ({ page }) => {
  await page.goto("/lab");
  await page.getByTestId("inject-fault-header").click();
  await page.getByTestId("begin-investigation").click();
  await page.getByTestId("root-hypothesis").click();
  await page.getByRole("button", { name: /Scale gateway replicas/ }).click();
  await page.getByTestId("execute-action").click();
  await expect(page.getByTestId("non-recovery")).toContainText("did not recover");
  await expect(page.getByText("Recovery verified")).not.toBeVisible();
});

test("scenario switch resets the audit state and exposes a different fixture", async ({ page }) => {
  await page.goto("/lab");
  await page.getByTestId("inject-fault-header").click();
  await page.getByRole("button", { name: /INC-319 Orders config regression/ }).click();
  await expect(page.getByRole("heading", { name: "INC-319 · Orders config regression" })).toBeVisible();
  await expect(page.getByText("Telemetry standby")).toBeVisible();
});

test("route navigation supports direct loads, refresh, and browser back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Practice the decisions/ })).toBeVisible();
  await page.getByRole("link", { name: "See how evidence works" }).click();
  await expect(page).toHaveURL(/\/evidence$/);
  await expect(page.getByRole("heading", { name: "Correlation before conclusion." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Correlation before conclusion." })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Start incident simulation" })).toBeVisible();
});

test("mobile workspace uses deliberate views without horizontal clipping", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab");
  await expect(page.getByRole("tab", { name: "Scenario" })).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("inject-fault-header").click();
  await expect(page.getByRole("tab", { name: /Signals/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Correlated evidence")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile route navigation remains reachable and does not obscure final content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/runbooks");
  await page.locator(".method-note").scrollIntoViewIfNeeded();
  const finalContent = await page.locator(".method-note").boundingBox();
  const mobileNav = await page.locator(".mobile-nav").boundingBox();
  expect(finalContent).not.toBeNull();
  expect(mobileNav).not.toBeNull();
  expect(finalContent!.y + finalContent!.height).toBeLessThanOrEqual(mobileNav!.y + 1);
  await page.getByRole("link", { name: "Evidence", exact: true }).last().click();
  await expect(page).toHaveURL(/\/evidence$/);
  await page.getByRole("link", { name: "Overview", exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/);
});

test("public scenario contract labels data as simulated", async ({ request }) => {
  const response = await request.get("/api/scenarios");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.meta).toEqual({ simulation: true, deterministic: true, count: 3 });
});
