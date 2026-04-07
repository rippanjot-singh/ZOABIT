const { vectorDB } = require("../config/db");

async function deleteTest() {
  const index = await vectorDB();

  try {
    await index.deleteMany({
      filter: {
        url: "https://sheryians.com"
      }
    });

    console.log("Deleted successfully");
  } catch (error) {
    console.log(error);
  }
}

deleteTest();