/*
 * Student Management & Performance System (MongoDB)
 *
 * Run with mongosh:
 *   mongosh --file student_management.js
 *   mongosh "<your Atlas connection string>" --file student_management.js
 * Or paste the whole script into the mongosh shell in MongoDB Compass.
 *
 * Design
 *   courses : one document per course, identified by a unique courseCode
 *   students: one document per student, with an embedded "marks" array
 *             holding { courseCode, score } for every course the student takes.
 *   Linking: students.marks.courseCode -> courses.courseCode
 *   Why embed marks: a student's marks are always read with the student, and
 *   one update changes one score without touching any other document.
 */

const dbm = db.getSiblingDB("student_management");

// ---------------------------------------------------------------------------
// 0. Clean start (safe to re-run)
// ---------------------------------------------------------------------------
dbm.students.drop();
dbm.courses.drop();

// ---------------------------------------------------------------------------
// 1. Create collections with validation rules
// ---------------------------------------------------------------------------
dbm.createCollection("courses", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["courseCode", "title", "credits", "department"],
      properties: {
        courseCode: { bsonType: "string", description: "Unique course code, e.g. CS101" },
        title: { bsonType: "string" },
        credits: { bsonType: "int", minimum: 1, maximum: 6 },
        department: { bsonType: "string" },
        instructor: { bsonType: "string" }
      }
    }
  }
});

dbm.createCollection("students", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["rollNo", "name", "email", "semester", "marks"],
      properties: {
        rollNo: { bsonType: "string" },
        name: { bsonType: "string" },
        email: { bsonType: "string", pattern: "^.+@.+\\..+$" },
        semester: { bsonType: "int", minimum: 1, maximum: 8 },
        marks: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["courseCode", "score"],
            properties: {
              courseCode: { bsonType: "string" },
              score: { bsonType: ["int", "double"], minimum: 0, maximum: 100 }
            }
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Insert initial records
// ---------------------------------------------------------------------------
dbm.courses.insertMany([
  { courseCode: "CS101", title: "Data Structures", credits: NumberInt(4), department: "Computer Science", instructor: "Dr. R. Mehta" },
  { courseCode: "CS102", title: "Database Management Systems", credits: NumberInt(4), department: "Computer Science", instructor: "Dr. S. Kapoor" },
  { courseCode: "CS103", title: "Operating Systems", credits: NumberInt(3), department: "Computer Science", instructor: "Dr. A. Sharma" },
  { courseCode: "MA101", title: "Discrete Mathematics", credits: NumberInt(3), department: "Mathematics", instructor: "Dr. P. Joshi" },
  { courseCode: "CY101", title: "Network Security", credits: NumberInt(4), department: "Cyber Security", instructor: "Dr. N. Verma" }
]);

dbm.students.insertMany([
  { rollNo: "S101", name: "Aarav Sharma", email: "aarav@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS101", score: 78 }, { courseCode: "CS102", score: 85 }, { courseCode: "MA101", score: 72 }] },
  { rollNo: "S102", name: "Priya Meena", email: "priya@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS101", score: 88 }, { courseCode: "CS102", score: 91 }, { courseCode: "CY101", score: 84 }] },
  { rollNo: "S103", name: "Rohit Singh", email: "rohit@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS101", score: 65 }, { courseCode: "CS103", score: 70 }, { courseCode: "MA101", score: 58 }] },
  { rollNo: "S104", name: "Neha Joshi", email: "neha@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS102", score: 79 }, { courseCode: "CS103", score: 82 }, { courseCode: "CY101", score: 90 }] },
  { rollNo: "S105", name: "Karan Gupta", email: "karan@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS101", score: 54 }, { courseCode: "CS102", score: 62 }, { courseCode: "CS103", score: 60 }] },
  { rollNo: "S106", name: "Ananya Verma", email: "ananya@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS102", score: 95 }, { courseCode: "MA101", score: 89 }, { courseCode: "CY101", score: 93 }] },
  { rollNo: "S107", name: "Vikram Rathore", email: "vikram@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS101", score: 71 }, { courseCode: "CS103", score: 66 }, { courseCode: "CY101", score: 75 }] },
  { rollNo: "S108", name: "Sneha Saini", email: "sneha@example.com", semester: NumberInt(3),
    marks: [{ courseCode: "CS102", score: 83 }, { courseCode: "CS103", score: 77 }, { courseCode: "MA101", score: 81 }] }
]);

print("\n=== 2. Records inserted ===");
print("Courses : " + dbm.courses.countDocuments());
print("Students: " + dbm.students.countDocuments());

// ---------------------------------------------------------------------------
// 3. Update student marks
// ---------------------------------------------------------------------------
// (a) Karan's CS101 paper was re-evaluated: 54 -> 68
const r1 = dbm.students.updateOne(
  { rollNo: "S105" },
  { $set: { "marks.$[m].score": 68 } },
  { arrayFilters: [{ "m.courseCode": "CS101" }] }
);

// (b) Rohit's MA101 marks corrected: 58 -> 63
const r2 = dbm.students.updateOne(
  { rollNo: "S103" },
  { $set: { "marks.$[m].score": 63 } },
  { arrayFilters: [{ "m.courseCode": "MA101" }] }
);

print("\n=== 3. Marks updated ===");
print("S105 CS101 -> matched " + r1.matchedCount + ", modified " + r1.modifiedCount);
print("S103 MA101 -> matched " + r2.matchedCount + ", modified " + r2.modifiedCount);
printjson(dbm.students.findOne({ rollNo: "S105" }, { _id: 0, rollNo: 1, name: 1, marks: 1 }));

// ---------------------------------------------------------------------------
// 4. Indexes on the courses collection
// ---------------------------------------------------------------------------
// Fast lookup by course code (also used by $lookup in the aggregation); unique
dbm.courses.createIndex({ courseCode: 1 }, { unique: true });
// Fast filtering by department, sorted by credits
dbm.courses.createIndex({ department: 1, credits: -1 });
// Supporting index on students for roll-number lookups
dbm.students.createIndex({ rollNo: 1 }, { unique: true });

print("\n=== 4. Indexes on courses ===");
printjson(dbm.courses.getIndexes().map(i => ({ name: i.name, key: i.key, unique: !!i.unique })));

// Prove the index is used for a department query
const plan = dbm.courses.find({ department: "Computer Science" }).explain("executionStats");
print("Query plan stage: " + JSON.stringify(plan.queryPlanner.winningPlan.inputStage
  ? plan.queryPlanner.winningPlan.inputStage.stage
  : plan.queryPlanner.winningPlan.stage));
print("Documents examined: " + plan.executionStats.totalDocsExamined +
      ", returned: " + plan.executionStats.nReturned);

// ---------------------------------------------------------------------------
// 5. Aggregation: students per course and average marks
// ---------------------------------------------------------------------------
print("\n=== 5. Total students in database ===");
print(dbm.students.countDocuments());

print("\n=== Students and average marks per course ===");
const report = dbm.students.aggregate([
  { $unwind: "$marks" },                                   // one row per student-course pair
  { $group: {
      _id: "$marks.courseCode",
      totalStudents: { $sum: 1 },
      averageMarks: { $avg: "$marks.score" }
  } },
  { $lookup: {                                             // bring in the course title
      from: "courses",
      localField: "_id",
      foreignField: "courseCode",
      as: "course"
  } },
  { $unwind: "$course" },
  { $project: {
      _id: 0,
      courseCode: "$_id",
      courseTitle: "$course.title",
      totalStudents: 1,
      averageMarks: { $round: ["$averageMarks", 2] }
  } },
  { $sort: { courseCode: 1 } }
]).toArray();

printjson(report);
