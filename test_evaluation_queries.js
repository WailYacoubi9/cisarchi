// MongoDB TP Section 7 - Test Script
// Run with: mongosh testdb < test_evaluation_queries.js

// Helper function to print section headers
function printHeader(text) {
  print("\n" + "=".repeat(60));
  print(text);
  print("=".repeat(60) + "\n");
}

// ============================================================
// E2: Aggregation by Decade
// ============================================================

printHeader("E2: ORIGINAL VERSION (String Sorting Issue)");

const originalE2 = db.movies.aggregate([
  {
    $addFields: {
      decade: {
        $concat: [
          { $toString: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] } },
          "-",
          { $toString: { $add: [{ $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, 9] } }
        ]
      }
    }
  },
  {
    $group: {
      _id: "$decade",
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      decennie: "$_id",
      nombreFilms: 1,
      dureeMoyenne: { $round: ["$dureeMoyenne", 1] }
    }
  }
]);

print("Results from ORIGINAL query:");
originalE2.forEach(doc => {
  printjson(doc);
});

printHeader("E2: CORRECTED VERSION (Numeric Sorting)");

const correctedE2 = db.movies.aggregate([
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
]);

print("Results from CORRECTED query:");
correctedE2.forEach(doc => {
  printjson(doc);
});

print("\nNOTE: If you have decades like 1990-1999 and 2010-2019,");
print("the original sorts them as: '1990-1999', '2000-2009', '2010-2019' (WRONG!)");
print("The corrected version ensures proper numeric ordering.");

// ============================================================
// E5: Queries on Genres
// ============================================================

printHeader("E5 Part 1: Movies with EXACTLY 3 genres");

const exactly3Genres = db.movies.find(
  { genres: { $size: 3 } },
  { title: 1, genres: 1, year: 1, _id: 0 }
).sort({ year: -1 });

print("Movies with exactly 3 genres:");
exactly3Genres.forEach(doc => {
  print(`${doc.title} (${doc.year}): ${doc.genres.join(", ")}`);
});

print(`\nTotal: ${db.movies.countDocuments({ genres: { $size: 3 } })} movies`);

printHeader("E5 Part 2: Movies with common genres with Inception");

// Get Inception's genres
const inception = db.movies.findOne({ title: "Inception" });
if (!inception) {
  print("ERROR: Inception not found in database!");
} else {
  const inceptionGenres = inception.genres;
  print(`Inception genres: ${inceptionGenres.join(", ")}`);

  const commonGenres = db.movies.find(
    {
      title: { $ne: "Inception" },
      genres: { $in: inceptionGenres }
    },
    { title: 1, genres: 1, year: 1, _id: 0 }
  ).sort({ year: -1 });

  print("\nMovies sharing at least one genre with Inception:");
  let count = 0;
  commonGenres.forEach(doc => {
    const common = doc.genres.filter(g => inceptionGenres.includes(g));
    print(`${doc.title} (${doc.year}): ${doc.genres.join(", ")} [Common: ${common.join(", ")}]`);
    count++;
  });

  print(`\nTotal: ${count} movies`);
}

printHeader("E5 Bonus: Different Genre Operators");

// $size - exactly N elements
print("1. $size - Exactly 2 genres:");
db.movies.find(
  { genres: { $size: 2 } },
  { title: 1, genres: 1, _id: 0 }
).limit(3).forEach(doc => {
  print(`   ${doc.title}: ${doc.genres.join(", ")}`);
});

// $in - at least one match
print("\n2. $in - Contains Sci-Fi OR Thriller:");
db.movies.find(
  { genres: { $in: ["Sci-Fi", "Thriller"] } },
  { title: 1, genres: 1, _id: 0 }
).limit(3).forEach(doc => {
  print(`   ${doc.title}: ${doc.genres.join(", ")}`);
});

// $all - all must match
print("\n3. $all - Contains BOTH Sci-Fi AND Thriller:");
db.movies.find(
  { genres: { $all: ["Sci-Fi", "Thriller"] } },
  { title: 1, genres: 1, _id: 0 }
).forEach(doc => {
  print(`   ${doc.title}: ${doc.genres.join(", ")}`);
});

// $expr with $size - more than N elements
print("\n4. $expr + $size - More than 2 genres:");
db.movies.find(
  { $expr: { $gt: [{ $size: "$genres" }, 2] } },
  { title: 1, genres: 1, _id: 0 }
).limit(3).forEach(doc => {
  print(`   ${doc.title}: ${doc.genres.join(", ")} (${doc.genres.length} genres)`);
});

// ============================================================
// Additional Verification Tests
// ============================================================

printHeader("VERIFICATION: Database Statistics");

print(`Total movies in collection: ${db.movies.countDocuments({})}`);
print(`Movies with 1 genre: ${db.movies.countDocuments({ genres: { $size: 1 } })}`);
print(`Movies with 2 genres: ${db.movies.countDocuments({ genres: { $size: 2 } })}`);
print(`Movies with 3 genres: ${db.movies.countDocuments({ genres: { $size: 3 } })}`);
print(`Movies with >3 genres: ${db.movies.countDocuments({ $expr: { $gt: [{ $size: "$genres" }, 3] } })}`);

printHeader("VERIFICATION: Genre Distribution");

const genreStats = db.movies.aggregate([
  { $unwind: "$genres" },
  { $group: { _id: "$genres", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

print("Genre frequency:");
genreStats.forEach(doc => {
  print(`   ${doc._id}: ${doc.count} movies`);
});

printHeader("TEST COMPLETED");
print("Review the results above to verify query correctness.");
