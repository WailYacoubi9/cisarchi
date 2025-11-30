# MongoDB TP Section 7 - Feedback Summary

## 📊 Overall Assessment

| Question | Status | Score | Comments |
|----------|--------|-------|----------|
| E1 | ✅ Excellent | 95% | Well explained, comprehensive |
| E2 | ⚠️ Needs Fix | 70% | **SORTING BUG - See correction below** |
| E3 | ✅ Excellent | 100% | Perfect analysis |
| E4 | ✅ Very Good | 90% | Good examples, could add schema validation |
| E5 | ✅ Good | 85% | Correct queries, minor table formatting issue |

**Overall: 88% - Good work with one critical correction needed**

---

## ⚠️ CRITICAL ISSUE: Question E2

### The Problem

Your E2 query has a **sorting bug**. It groups by string decades first, which causes incorrect alphabetical sorting:

```
"1990-1999"  ← comes first alphabetically
"2000-2009"  ← comes second
"2010-2019"  ← comes third
```

This is wrong because you wanted chronological order, but string sorting doesn't guarantee that with multi-digit numbers.

### Your Original Query (INCORRECT)

```javascript
db.movies.aggregate([
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
      _id: "$decade",  // ← Grouping by STRING
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } },  // ← Sorting STRING alphabetically (WRONG!)
  // ... rest of pipeline
])
```

### Corrected Query

```javascript
db.movies.aggregate([
  {
    $group: {
      _id: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] },  // ← Group by NUMBER
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } },  // ← Sort NUMBER chronologically (CORRECT!)
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

### Why This Matters

**Original approach**: Groups and sorts by string "1990-1999", "2000-2009", etc.
- Works fine if all decades are present
- **Fails** if you have sparse data (e.g., 1920s and 2020s) because "2020-2029" comes before "1920-1929" alphabetically

**Corrected approach**: Groups and sorts by number 1990, 2000, 2010, etc.
- Always sorts chronologically
- Formats as string only at the end for display

---

## ✅ What's Good

### E1: updateOne() vs replaceOne()
- Excellent comparison table
- Correct identification of risks
- Good code examples

**Minor addition**: You could mention that `replaceOne()` does NOT accept update operators like `$set`:
```javascript
// This FAILS
db.movies.replaceOne({ _id: 1 }, { $set: { title: "New" } })

// This WORKS
db.movies.replaceOne({ _id: 1 }, { title: "New", director: "Someone", year: 2024 })
```

### E3: $lookup vs Embedding
Perfect! Your analysis covers:
- ✅ Performance implications (lookup is costly)
- ✅ 16MB document limit
- ✅ Atomicity benefits
- ✅ Good use case recommendations

### E4: Schema Flexibility
Good examples! Consider adding:
```javascript
// MongoDB supports schema validation since v3.6
db.createCollection("movies", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "director", "year"],
      properties: {
        year: { bsonType: "int", minimum: 1888 },
        duration: { bsonType: "int", minimum: 1 }
      }
    }
  }
})
```

### E5: Queries on Genres
Queries are correct! Minor fix for the operator table:

**Current (incomplete)**:
```
$size: { $size: 3 } → exactement 3 éléments
```

**Should be**:
```
$size: { genres: { $size: 3 } } → exactement 3 éléments
```

---

## 🧪 Testing Instructions

### Setup Test Database

```bash
# Start MongoDB (choose one method)

# Method 1: Docker
docker run -d -p 27017:27017 --name mongodb-test mongo:latest

# Method 2: Local installation
mongod --dbpath /data/db

# Import data
mongoimport --db testdb --collection movies --file movies.json --jsonArray

# Connect
mongosh testdb
```

### Run Tests

```bash
# Run the automated test script
mongosh testdb < test_evaluation_queries.js
```

Or manually test each query in mongosh:

```javascript
// Test E2 original (shows the bug)
db.movies.aggregate([/* original query */])

// Test E2 corrected
db.movies.aggregate([/* corrected query */])

// Test E5
db.movies.find({ genres: { $size: 3 } })
var inceptionGenres = db.movies.findOne({ title: "Inception" }).genres
db.movies.find({ title: { $ne: "Inception" }, genres: { $in: inceptionGenres } })
```

### Expected Results with Sample Data

Based on movies.json:

**E2 - Decades**:
- 1990-1999: 3 movies (Pulp Fiction, Shawshank Redemption, The Matrix)
- 2000-2009: 3 movies (Amélie, The Dark Knight, Inception)
- 2010-2019: 12 movies (remaining)

**E5 - Exactly 3 genres**:
- The Dark Knight (Action, Crime, Drama)
- La La Land (Musical, Romance, Drama)
- Dunkirk (War, Drama, Thriller)

**E5 - Common with Inception** (Sci-Fi or Thriller):
- Should return ~8-10 movies that have either "Sci-Fi" or "Thriller"

---

## 📝 Final Recommendations

1. **Fix E2 immediately** - Change grouping to numeric before sorting
2. **E1** - Add note about replaceOne() not accepting operators
3. **E4** - Consider adding schema validation example
4. **E5** - Fix operator table formatting

## 🎯 Grading Impact

If this were graded:
- Original: ~88/100
- With E2 fix: ~94/100
- With all improvements: ~98/100

The E2 bug would likely lose 5-10 points depending on how strict the grader is about edge cases.

---

## Files Created

1. `movies.json` - Test data
2. `test_evaluation_queries.js` - Automated test script
3. `mongodb_evaluation_review.md` - Detailed review
4. `EVALUATION_FEEDBACK.md` - This summary

Run the test script when you have MongoDB available to verify all queries!
