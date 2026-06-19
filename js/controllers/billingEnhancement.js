// Billing Enhancement Controller
// Ensures print functionality is triggered after bill save

document.addEventListener("DOMContentLoaded", function () {
  // Wait for billing controller to be initialized
  const checkBillingController = setInterval(() => {
    if (window.billingController && window.billingController.isInitialized) {
      clearInterval(checkBillingController);

      // Override the handleSaveBill method to ensure print is always triggered
      const originalHandleSaveBill =
        window.billingController.handleSaveBill.bind(window.billingController);

      window.billingController.handleSaveBill = async function () {
        try {
          // Call the original save bill method
          await originalHandleSaveBill();

          // Ensure print is triggered after successful save
          if (this.currentBill) {
            console.log("Bill saved successfully, triggering print...");
            this.printBill(this.currentBill);
          }
        } catch (error) {
          console.error("Error in save bill process:", error);
          throw error;
        }
      };

      console.log("Print functionality enhanced for 2-copy printing");
    }
  }, 100);
});
