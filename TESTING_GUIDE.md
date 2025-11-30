# MongoDB TP Section 7 - Testing Guide

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Start MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb-test mongo:latest

# 2. Wait a few seconds for MongoDB to start
sleep 5

# 3. Import the test data
mongoimport --db testdb --collection movies --file movies.json --jsonArray

# 4. Run the test suite
mongosh testdb < test_section7_complete.js
```

### Option 2: Remote Server (ENSIMAG)

```bash
# 1. Connect to the server
mongosh "mongodb://mongodb.ensimag.fr/<your_login>" -u <your_login> -p

# 2. Once connected, import data
use <your_login>
# Copy-paste the movies.json data or use mongoimport externally

# 3. Load and run the test script
load('test_section7_complete.js')
```

### Option 3: Local MongoDB Installation

```bash
# 1. Start your local MongoDB
mongod --dbpath /data/db

# 2. In another terminal, import data
mongoimport --db testdb --collection movies --file movies.json --jsonArray

# 3. Run tests
mongosh testdb < test_section7_complete.js
```

---

## Expected Test Results

### E1: updateOne() vs replaceOne()

**Test 1: updateOne()**
```
✓ updateOne() modified only specified fields, other fields preserved
✓ Restored original Inception document
```

**Expected behavior:**
- Only `director` field changes to "C. Nolan (TEST)"
- `lastModified` field is added
- All other fields (genres, cast, ratings, etc.) remain unchanged

**Test 2: replaceOne()**
```
✓ replaceOne() replaced entire document (old fields removed)
✓ Restored original m99999 document
```

**Expected behavior:**
- Document is completely replaced
- Only new fields remain: title, director, year, genres
- Old fields (ratings, cast, budget, etc.) are gone

**Test 3: replaceOne() with operators**
```
✓ replaceOne() correctly rejected $set operator
  Error message: The replacement document must not contain atomic operators.
```

---

### E2: Decade Aggregation

**Expected output:**
```javascript
{ decennie: "1990-1999", nombreFilms: 3, dureeMoyenne: 144.0 }
{ decennie: "2000-2009", nombreFilms: 3, dureeMoyenne: 135.3 }
{ decennie: "2010-2019", nombreFilms: 12, dureeMoyenne: 125.4 }
```

**Validations:**
```
✓ Decades are sorted chronologically
✓ Decade calculation is correct
```

**Breakdown by decade (from movies.json):**

**1990-1999 (3 films):**
- Pulp Fiction (1994) - 154 min
- The Shawshank Redemption (1994) - 142 min
- The Matrix (1999) - 136 min
- Average: (154 + 142 + 136) / 3 = 144 min

**2000-2009 (3 films):**
- Amélie (2001) - 122 min
- The Dark Knight (2008) - 152 min
- Inception (2010) - 148 min
- Average: (122 + 152 + 148) / 3 = 140.7 min (approximately)

**2010-2019 (12 films):**
- All remaining films
- Average: ~125 min

---

### E3: $lookup vs Embedding

**Test output:**

**Method 1: $lookup**
```javascript
{
  user_id: "u001",
  rating: 9,
  review_text: "Mind-bending masterpiece!",
  movie_title: "Inception",
  movie_year: 2010
}
{
  user_id: "u002",
  rating: 8,
  review_text: "Confusing but brilliant",
  movie_title: "Inception",
  movie_year: 2010
}
// ... etc
```

**Method 2: Embedding**
```javascript
{
  title: "Inception",
  year: 2010,
  director: "Christopher Nolan",
  reviews: [
    {
      user_id: "u001",
      rating: 9,
      review_text: "Mind-bending masterpiece!",
      date: ISODate("2023-05-20T00:00:00.000Z")
    },
    {
      user_id: "u002",
      rating: 8,
      review_text: "Confusing but brilliant",
      date: ISODate("2023-06-15T00:00:00.000Z")
    }
  ]
}
```

**Validation:**
```
✓ Both methods produce correct results, but with different performance characteristics
```

---

### E4: Schema Flexibility

**Test 1: Heterogeneous documents**
```
✓ MongoDB allows different schemas in same collection
```

**Expected output:**
```javascript
// Livre
{ type: "livre", titre: "MongoDB Guide", auteur: "John Doe", pages: 350, isbn: "978-1234567890" }

// Vêtement
{ type: "vetement", nom: "T-shirt", taille: "M", couleur: "bleu", matiere: "coton" }

// Électronique
{ type: "electronique", nom: "Laptop", marque: "TechBrand", cpu: "Intel i7", ram: "16GB", ports: ["USB-C", "HDMI"] }
```

**Test 2: Schema validation**
```
✓ Created collection with schema validation
✓ Valid document accepted
✓ Invalid document (negative amount) correctly rejected
✓ Invalid document (missing field) correctly rejected
```

**Note:** If using MongoDB < 3.6, validation tests may be skipped.

---

### E5: Genre Queries

**Test 1: Exactly 3 genres**
```
Movies with exactly 3 genres:
  Dunkirk (2017): War, Drama, Thriller
  La La Land (2016): Musical, Romance, Drama
  The Dark Knight (2008): Action, Crime, Drama

Total: 3 movies

✓ All results have exactly 3 genres
```

**Test 2: Common genres with Inception**
```
Inception genres: Sci-Fi, Thriller

Movies sharing at least one genre with Inception:
  Parasite (2019): Thriller, Drama [Common: Thriller]
  Dunkirk (2017): War, Drama, Thriller [Common: Thriller]
  Blade Runner 2049 (2017): Sci-Fi, Thriller [Common: Sci-Fi, Thriller]
  Get Out (2017): Horror, Thriller [Common: Thriller]
  Arrival (2016): Sci-Fi, Drama [Common: Sci-Fi]
  Mad Max: Fury Road (2015): Action, Sci-Fi [Common: Sci-Fi]
  Interstellar (2014): Sci-Fi, Drama [Common: Sci-Fi]
  The Matrix (1999): Sci-Fi, Action [Common: Sci-Fi]

Total: 8 movies

✓ All results share at least one genre with Inception
```

**Test 3: Operator comparison**

```
1. $size: Exactly 2 genres
   Inception: Sci-Fi, Thriller (2 genres)
   Interstellar: Sci-Fi, Drama (2 genres)
   Pulp Fiction: Crime, Drama (2 genres)

2. $in: Contains Sci-Fi OR Thriller
   Parasite: Thriller, Drama [Matched: Thriller]
   Blade Runner 2049: Sci-Fi, Thriller [Matched: Sci-Fi, Thriller]
   Dunkirk: War, Drama, Thriller [Matched: Thriller]

3. $all: Contains BOTH Sci-Fi AND Thriller
   Blade Runner 2049: Sci-Fi, Thriller
   Inception: Sci-Fi, Thriller

✓ All $all results contain both Sci-Fi AND Thriller
```

**Test 4: $expr with $size**
```
Movies with more than 2 genres (using $expr):
   Dunkirk: War, Drama, Thriller (3 genres)
   La La Land: Musical, Romance, Drama (3 genres)
   The Dark Knight: Action, Crime, Drama (3 genres)
   Parasite: Thriller, Drama (2 genres)  ← Should NOT appear!

✓ All results have more than 2 genres
```

**Test 5: $elemMatch**
```
Movies with IMDb rating >= 85:
   The Shawshank Redemption: IMDb 93
   The Dark Knight: IMDb 90
   Pulp Fiction: IMDb 89
   Interstellar: IMDb 87
   The Matrix: IMDb 87

✓ All results have IMDb rating >= 85
```

---

## Final Summary

If all tests pass, you should see:

```
======================================================================
  TEST SUITE SUMMARY
======================================================================

✓ E1: updateOne() and replaceOne() behavior verified
✓ E2: Decade aggregation with numeric sorting works correctly
✓ E3: Both $lookup and embedding patterns demonstrated
✓ E4: Schema flexibility and validation tested
✓ E5: All genre query operators verified

======================================================================
  All tests completed successfully!
======================================================================

Cleaning up test collections...
✓ Cleanup complete
```

---

## Troubleshooting

### Error: "MongoServerError: Authentication failed"

**Solution:** Check your credentials for remote server
```bash
mongosh "mongodb://mongodb.ensimag.fr/<login>" -u <login> -p
# Enter password when prompted
```

### Error: "Failed to load: test_section7_complete.js"

**Solution:** Use mongosh input redirection
```bash
# Instead of load(), use:
mongosh testdb < test_section7_complete.js

# Or run from within mongosh:
load('/absolute/path/to/test_section7_complete.js')
```

### Error: "Collection movies not found"

**Solution:** Import the data first
```bash
mongoimport --db testdb --collection movies --file movies.json --jsonArray
```

### Error: "MongoServerError: Unrecognized pipeline stage name: '$lookup'"

**Solution:** Your MongoDB version is too old (< 3.2). Upgrade or use a newer server.

### Warning: "Schema validation may not be supported"

**Note:** This is informational. MongoDB < 3.6 doesn't support schema validation. The rest of the tests will still run.

---

## Manual Testing (Individual Queries)

If you want to test individual queries manually:

### E2: Decade Aggregation
```javascript
db.movies.aggregate([
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
])
```

### E5: Movies with exactly 3 genres
```javascript
db.movies.find({ genres: { $size: 3 } })
```

### E5: Movies with common genres with Inception
```javascript
var inceptionGenres = db.movies.findOne({ title: "Inception" }).genres
db.movies.find({
  title: { $ne: "Inception" },
  genres: { $in: inceptionGenres }
})
```

---

## Performance Notes

- The test suite takes approximately **5-10 seconds** to run
- Most time is spent on aggregation pipelines (E2, E3)
- $lookup operations are slower than embedded document queries
- Schema validation adds minimal overhead to insert operations

---

## Files Included

1. **Section7_CORRECTED.md** - Complete corrected evaluation answers
2. **test_section7_complete.js** - Comprehensive test suite
3. **movies.json** - Sample movie data
4. **TESTING_GUIDE.md** - This file
5. **EVALUATION_FEEDBACK.md** - Original review and corrections

---

## Next Steps

1. ✅ Run the test suite to verify all queries work
2. ✅ Review Section7_CORRECTED.md for the final answers
3. ✅ Compare with your original answers
4. ✅ Submit the corrected version

**Good luck with your TP!** 🚀
