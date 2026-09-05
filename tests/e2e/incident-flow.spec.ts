import { expect, test } from "@playwright/test";

test("operator traces a fault to a verified recovery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find the cause. Control the recovery." })).toBeVisible();
  await expect(page.getByText("Simulated environment")).toBeVisible();
  await page.getByTestId("inject-fault").click();
  await expect(page.getByText("Correlated evidence")).toBeVisible();
  await page.getByTestId("begin-investigation").click();
  await page.getByTestId("root-hypothesis").click();
  await page.getByTestId("correct-action").click();
  await page.getByTestId("execute-action").click();
  await expect(page.getByTestId("recovery-verified")).toContainText("SLO back inside target");
});

test("wrong remediation visibly fails and preserves the incident", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("inject-fault").click();
  await page.getByTestId("begin-investigation").click();
  await page.getByTestId("root-hypothesis").click();
  await page.getByRole("button", { name: /Scale gateway replicas/ }).click();
  await page.getByTestId("execute-action").click();
  await expect(page.getByTestId("non-recovery")).toContainText("did not recover");
  await expect(page.getByText("Recovery verified")).not.toBeVisible();
});

test("scenario switch resets the audit state and exposes a different fixture", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("inject-fault").click();
  await page.locator("#scenario").selectOption("bad-deploy");
  await expect(page.getByRole("heading", { name: "Orders config regression" })).toBeVisible();
  await expect(page.getByText("All systems nominal")).toBeVisible();
});

test("public scenario contract labels data as simulated", async ({ request }) => {
  const response = await request.get("/api/scenarios");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.meta).toEqual({ simulation: true, deterministic: true, count: 3 });
});
