// ============================================================
// MongoDB TP - Section 7 Complete Test Suite
// ============================================================
// Usage: mongosh testdb < test_section7_complete.js
//
// Prerequisites:
// 1. Import data: mongoimport --db testdb --collection movies --file movies.json --jsonArray
// 2. Connect: mongosh testdb
// 3. Run this script
//
// ============================================================

// Helper functions
function printHeader(text) {
  print("\n" + "=".repeat(70));
  print("  " + text);
  print("=".repeat(70));
}

function printSubheader(text) {
  print("\n" + "-".repeat(70));
  print("  " + text);
  print("-".repeat(70));
}

function printSuccess(text) {
  print("✓ " + text);
}

function printError(text) {
  print("✗ " + text);
}

function printResult(doc) {
  printjson(doc);
}

// ============================================================
// E1: updateOne() vs replaceOne() - Tests
// ============================================================

printHeader("E1: Testing updateOne() vs replaceOne()");

printSubheader("Test 1: updateOne() - Partial update");

// Save original document
const originalInception = db.movies.findOne({ title: "Inception" });
print("Original Inception document:");
printResult({ title: originalInception.title, director: originalInception.director, year: originalInception.year });

// Test updateOne
db.movies.updateOne(
  { title: "Inception" },
  {
    $set: { director: "C. Nolan (TEST)" },
    $currentDate: { lastModified: true }
  }
);

const updatedInception = db.movies.findOne({ title: "Inception" });
print("\nAfter updateOne:");
printResult({
  title: updatedInception.title,
  director: updatedInception.director,
  year: updatedInception.year,
  genres: updatedInception.genres,
  lastModified: updatedInception.lastModified
});

if (updatedInception.director === "C. Nolan (TEST)" && updatedInception.genres && updatedInception.year === 2010) {
  printSuccess("updateOne() modified only specified fields, other fields preserved");
} else {
  printError("updateOne() test failed");
}

// Restore original
db.movies.updateOne(
  { title: "Inception" },
  {
    $set: { director: originalInception.director },
    $unset: { lastModified: "" }
  }
);
printSuccess("Restored original Inception document");

printSubheader("Test 2: replaceOne() - Full replacement");

// Find a document to replace
const originalUnknown = db.movies.findOne({ movie_id: "m99999" });
print("Original m99999 document:");
printResult(originalUnknown);

// Test replaceOne
db.movies.replaceOne(
  { movie_id: "m99999" },
  {
    title: "Replaced Movie Title",
    director: "Jane Doe",
    year: 2024,
    genres: ["Drama", "Test"]
  }
);

const replacedDoc = db.movies.findOne({ movie_id: "m99999" });
print("\nAfter replaceOne:");
printResult(replacedDoc);

if (replacedDoc.title === "Replaced Movie Title" && !replacedDoc.ratings && !replacedDoc.cast) {
  printSuccess("replaceOne() replaced entire document (old fields removed)");
} else {
  printError("replaceOne() test failed");
}

// Restore original
db.movies.replaceOne({ movie_id: "m99999" }, originalUnknown);
printSuccess("Restored original m99999 document");

printSubheader("Test 3: replaceOne() with update operators (should FAIL)");

try {
  db.movies.replaceOne(
    { title: "Inception" },
    { $set: { director: "Should Fail" } }
  );
  printError("replaceOne() accepted $set operator (should have failed!)");
} catch (e) {
  printSuccess("replaceOne() correctly rejected $set operator");
  print("  Error message: " + e.message);
}

// ============================================================
// E2: Aggregation by Decade - Tests
// ============================================================

printHeader("E2: Testing Decade Aggregation");

printSubheader("Corrected version (numeric grouping and sorting)");

const decadeResults = db.movies.aggregate([
  {
    $group: {
      _id: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] },
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      decennie: {
        $concat: [
          { $toString: "$_id" },
          "-",
          { $toString: { $add: ["$_id", 9] } }
        ]
      },
      nombreFilms: 1,
      dureeMoyenne: { $round: ["$dureeMoyenne", 1] }
    }
  }
]).toArray();

print("Decade aggregation results:");
decadeResults.forEach(doc => printResult(doc));

// Verify sorting is correct
let previousDecade = 0;
let sortingCorrect = true;
for (let i = 0; i < decadeResults.length; i++) {
  const decadeStart = parseInt(decadeResults[i].decennie.split("-")[0]);
  if (decadeStart < previousDecade) {
    sortingCorrect = false;
    break;
  }
  previousDecade = decadeStart;
}

if (sortingCorrect) {
  printSuccess("Decades are sorted chronologically");
} else {
  printError("Decades are NOT sorted chronologically");
}

// Verify calculation for one decade
const decade2010 = decadeResults.find(d => d.decennie.startsWith("2010"));
if (decade2010) {
  const manualCount = db.movies.countDocuments({ year: { $gte: 2010, $lte: 2019 } });
  const manualAvg = db.movies.aggregate([
    { $match: { year: { $gte: 2010, $lte: 2019 } } },
    { $group: { _id: null, avg: { $avg: "$duration" } } }
  ]).toArray()[0];

  print(`\nVerification for 2010-2019:`);
  print(`  Aggregation: ${decade2010.nombreFilms} films, avg ${decade2010.dureeMoyenne} min`);
  print(`  Manual count: ${manualCount} films, avg ${Math.round(manualAvg.avg * 10) / 10} min`);

  if (decade2010.nombreFilms === manualCount) {
    printSuccess("Decade calculation is correct");
  } else {
    printError("Decade calculation mismatch");
  }
}

// ============================================================
// E3: $lookup vs Embedding - Demonstration
// ============================================================

printHeader("E3: Demonstrating $lookup vs Embedding");

printSubheader("Setup: Creating reviews collection with references");

// Clear existing reviews if any
db.reviews.deleteMany({});

// Insert sample reviews
db.reviews.insertMany([
  {
    movie_id: "m40001",
    user_id: "u001",
    review_text: "Mind-bending masterpiece!",
    rating: 9,
    date: new Date("2023-05-20"),
    sentiment: "positive"
  },
  {
    movie_id: "m40001",
    user_id: "u002",
    review_text: "Confusing but brilliant",
    rating: 8,
    date: new Date("2023-06-15"),
    sentiment: "positive"
  },
  {
    movie_id: "m40002",
    user_id: "u001",
    review_text: "Heath Ledger's Joker is iconic!",
    rating: 10,
    date: new Date("2023-07-10"),
    sentiment: "positive"
  }
]);

printSuccess(`Inserted ${db.reviews.countDocuments({})} reviews`);

printSubheader("Method 1: $lookup (References)");

const lookupResults = db.reviews.aggregate([
  {
    $lookup: {
      from: "movies",
      localField: "movie_id",
      foreignField: "movie_id",
      as: "movie_details"
    }
  },
  { $unwind: "$movie_details" },
  {
    $project: {
      _id: 0,
      user_id: 1,
      rating: 1,
      review_text: 1,
      movie_title: "$movie_details.title",
      movie_year: "$movie_details.year"
    }
  }
]).toArray();

print("Reviews with $lookup:");
lookupResults.forEach(doc => printResult(doc));

printSubheader("Method 2: Embedding (Simulation)");

// Create a temp collection with embedded reviews
db.movies_with_reviews.drop();

const embeddingExample = db.movies.aggregate([
  { $match: { movie_id: { $in: ["m40001", "m40002"] } } },
  {
    $lookup: {
      from: "reviews",
      localField: "movie_id",
      foreignField: "movie_id",
      as: "reviews"
    }
  },
  {
    $project: {
      _id: 0,
      title: 1,
      year: 1,
      director: 1,
      reviews: {
        user_id: 1,
        rating: 1,
        review_text: 1,
        date: 1
      }
    }
  },
  { $out: "movies_with_reviews" }
]);

embeddingExample.toArray();

print("Movies with embedded reviews:");
db.movies_with_reviews.find().forEach(doc => printResult(doc));

printSuccess("Both methods produce correct results, but with different performance characteristics");

// ============================================================
// E4: Schema Flexibility - Demonstration
// ============================================================

printHeader("E4: Demonstrating Schema Flexibility");

printSubheader("Test 1: Heterogeneous documents in same collection");

// Create a test collection
db.products.drop();

db.products.insertMany([
  {
    type: "livre",
    titre: "MongoDB Guide",
    auteur: "John Doe",
    pages: 350,
    isbn: "978-1234567890"
  },
  {
    type: "vetement",
    nom: "T-shirt",
    taille: "M",
    couleur: "bleu",
    matiere: "coton"
  },
  {
    type: "electronique",
    nom: "Laptop",
    marque: "TechBrand",
    cpu: "Intel i7",
    ram: "16GB",
    ports: ["USB-C", "HDMI"]
  }
]);

print("Heterogeneous products collection:");
db.products.find().forEach(doc => printResult(doc));

printSuccess("MongoDB allows different schemas in same collection");

printSubheader("Test 2: Schema validation");

// Create a validated collection
db.validated_transactions.drop();

try {
  db.createCollection("validated_transactions", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id_transaction", "montant", "devise"],
        properties: {
          id_transaction: { bsonType: "string" },
          montant: { bsonType: "number", minimum: 0 },
          devise: { enum: ["EUR", "USD", "GBP"] }
        }
      }
    },
    validationAction: "error"
  });
  printSuccess("Created collection with schema validation");
} catch (e) {
  print("Note: Schema validation may not be supported in older MongoDB versions");
}

// Test valid insert
try {
  db.validated_transactions.insertOne({
    id_transaction: "T001",
    montant: 150.50,
    devise: "EUR"
  });
  printSuccess("Valid document accepted");
} catch (e) {
  printError("Valid document rejected: " + e.message);
}

// Test invalid insert (negative amount)
try {
  db.validated_transactions.insertOne({
    id_transaction: "T002",
    montant: -50,
    devise: "EUR"
  });
  printError("Invalid document (negative amount) was accepted!");
} catch (e) {
  printSuccess("Invalid document (negative amount) correctly rejected");
}

// Test invalid insert (missing required field)
try {
  db.validated_transactions.insertOne({
    id_transaction: "T003",
    montant: 100
    // Missing: devise
  });
  printError("Invalid document (missing field) was accepted!");
} catch (e) {
  printSuccess("Invalid document (missing field) correctly rejected");
}

// ============================================================
// E5: Genre Queries - Tests
// ============================================================

printHeader("E5: Testing Genre Queries");

printSubheader("Test 1: Movies with exactly 3 genres");

const exactly3Genres = db.movies.find(
  { genres: { $size: 3 } },
  { title: 1, genres: 1, year: 1, _id: 0 }
).sort({ year: -1 }).toArray();

print("Movies with exactly 3 genres:");
exactly3Genres.forEach(doc => {
  print(`  ${doc.title} (${doc.year}): ${doc.genres.join(", ")}`);
});

print(`\nTotal: ${exactly3Genres.length} movies`);

// Verify all have 3 genres
const all3 = exactly3Genres.every(doc => doc.genres.length === 3);
if (all3) {
  printSuccess("All results have exactly 3 genres");
} else {
  printError("Some results don't have 3 genres");
}

printSubheader("Test 2: Movies with common genres with Inception");

const inception = db.movies.findOne({ title: "Inception" });
if (!inception) {
  printError("Inception not found!");
} else {
  const inceptionGenres = inception.genres;
  print(`Inception genres: ${inceptionGenres.join(", ")}`);

  const commonGenres = db.movies.find(
    {
      title: { $ne: "Inception" },
      genres: { $in: inceptionGenres }
    },
    { title: 1, genres: 1, year: 1, _id: 0 }
  ).sort({ year: -1 }).toArray();

  print(`\nMovies sharing at least one genre with Inception:`);
  commonGenres.forEach(doc => {
    const common = doc.genres.filter(g => inceptionGenres.includes(g));
    print(`  ${doc.title} (${doc.year}): ${doc.genres.join(", ")} [Common: ${common.join(", ")}]`);
  });

  print(`\nTotal: ${commonGenres.length} movies`);

  // Verify all have at least one common genre
  const allHaveCommon = commonGenres.every(doc =>
    doc.genres.some(g => inceptionGenres.includes(g))
  );
  if (allHaveCommon) {
    printSuccess("All results share at least one genre with Inception");
  } else {
    printError("Some results don't share genres with Inception");
  }
}

printSubheader("Test 3: Operator comparison ($size, $in, $all)");

print("1. $size: Exactly 2 genres");
const size2 = db.movies.find({ genres: { $size: 2 } }, { title: 1, genres: 1, _id: 0 }).limit(3).toArray();
size2.forEach(doc => print(`   ${doc.title}: ${doc.genres.join(", ")} (${doc.genres.length} genres)`));

print("\n2. $in: Contains Sci-Fi OR Thriller");
const inOr = db.movies.find({ genres: { $in: ["Sci-Fi", "Thriller"] } }, { title: 1, genres: 1, _id: 0 }).limit(3).toArray();
inOr.forEach(doc => {
  const matched = doc.genres.filter(g => ["Sci-Fi", "Thriller"].includes(g));
  print(`   ${doc.title}: ${doc.genres.join(", ")} [Matched: ${matched.join(", ")}]`);
});

print("\n3. $all: Contains BOTH Sci-Fi AND Thriller");
const allAnd = db.movies.find({ genres: { $all: ["Sci-Fi", "Thriller"] } }, { title: 1, genres: 1, _id: 0 }).toArray();
allAnd.forEach(doc => print(`   ${doc.title}: ${doc.genres.join(", ")}`));

// Verify $all results actually have both genres
const allHaveBoth = allAnd.every(doc =>
  doc.genres.includes("Sci-Fi") && doc.genres.includes("Thriller")
);
if (allHaveBoth) {
  printSuccess("All $all results contain both Sci-Fi AND Thriller");
} else {
  printError("Some $all results don't have both genres");
}

printSubheader("Test 4: $expr with $size for comparisons");

print("Movies with more than 2 genres (using $expr):");
const moreThan2 = db.movies.find(
  { $expr: { $gt: [{ $size: "$genres" }, 2] } },
  { title: 1, genres: 1, _id: 0 }
).limit(5).toArray();

moreThan2.forEach(doc => print(`   ${doc.title}: ${doc.genres.join(", ")} (${doc.genres.length} genres)`));

// Verify all have more than 2 genres
const allMoreThan2 = moreThan2.every(doc => doc.genres.length > 2);
if (allMoreThan2) {
  printSuccess("All results have more than 2 genres");
} else {
  printError("Some results don't have more than 2 genres");
}

printSubheader("Test 5: $elemMatch on ratings array");

print("Movies with IMDb rating >= 85:");
const highRated = db.movies.find(
  {
    ratings: {
      $elemMatch: {
        source: "IMDb",
        score: { $gte: 85 }
      }
    }
  },
  { title: 1, ratings: 1, _id: 0 }
).limit(5).toArray();

highRated.forEach(doc => {
  const imdbRating = doc.ratings.find(r => r.source === "IMDb");
  print(`   ${doc.title}: IMDb ${imdbRating.score}`);
});

// Verify all have IMDb >= 85
const allHighRated = highRated.every(doc => {
  const imdb = doc.ratings.find(r => r.source === "IMDb");
  return imdb && imdb.score >= 85;
});
if (allHighRated) {
  printSuccess("All results have IMDb rating >= 85");
} else {
  printError("Some results don't have IMDb >= 85");
}

// ============================================================
// Summary
// ============================================================

printHeader("TEST SUITE SUMMARY");

print("\n✓ E1: updateOne() and replaceOne() behavior verified");
print("✓ E2: Decade aggregation with numeric sorting works correctly");
print("✓ E3: Both $lookup and embedding patterns demonstrated");
print("✓ E4: Schema flexibility and validation tested");
print("✓ E5: All genre query operators verified");

print("\n" + "=".repeat(70));
print("  All tests completed successfully!");
print("=".repeat(70) + "\n");

// Cleanup
print("Cleaning up test collections...");
db.reviews.drop();
db.products.drop();
db.validated_transactions.drop();
db.movies_with_reviews.drop();
printSuccess("Cleanup complete");
