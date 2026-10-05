// DUMMY DATA ONLY. No real student or parent information belongs in this repository.
// Emails use the reserved example.com domain so a test can never reach a real person.
// Real data is loaded later through CSV import / the Warden panel.

export type DummyRoom = { roomNumber: string; capacity: number };
export type DummyStudent = {
  code: string;
  name: string;
  roomNumber: string;
  parentName: string;
  parentEmail: string;
  parentWhatsapp: string; // input format; normalised to E.164 by the seed script
};

export const dummyRooms: DummyRoom[] = [
  { roomNumber: "101", capacity: 2 },
  { roomNumber: "102", capacity: 1 },
  { roomNumber: "103", capacity: 2 },
  { roomNumber: "104", capacity: 1 },
  { roomNumber: "105", capacity: 2 }, // one student only -> still has a free bed
  { roomNumber: "201", capacity: 2 },
  { roomNumber: "202", capacity: 2 },
  { roomNumber: "203", capacity: 1 },
  { roomNumber: "204", capacity: 2 },
  { roomNumber: "205", capacity: 1 },
];

const s = (
  n: number,
  name: string,
  roomNumber: string,
  parentName: string,
  parentWhatsapp: string,
): DummyStudent => ({
  code: `DUMMY-${String(n).padStart(3, "0")}`,
  name,
  roomNumber,
  parentName,
  parentEmail: `parent.dummy${n}@example.com`,
  parentWhatsapp,
});

export const dummyStudents: DummyStudent[] = [
  s(1, "Rahul Verma", "101", "Mr. Suresh Verma", "90000 00101"),
  s(2, "Aman Singh", "101", "Mr. Dinesh Singh", "90000 00102"),
  s(3, "Mohit Sharma", "102", "Mrs. Anita Sharma", "90000 00103"),
  s(4, "Karan Yadav", "103", "Mr. Ramesh Yadav", "90000 00104"),
  s(5, "Vikas Gupta", "103", "Mr. Mahesh Gupta", "90000 00105"),
  s(6, "Deepak Joshi", "104", "Mrs. Sunita Joshi", "90000 00106"),
  s(7, "Sumit Kumar", "105", "Mr. Anil Kumar", "90000 00107"),
  // Brothers sharing one parent number: one parent account, two linked students.
  s(8, "Yash Verma", "201", "Mr. Suresh Verma", "90000 00101"),
  s(9, "Rohan Mehta", "201", "Mr. Sanjay Mehta", "90000 00109"),
  s(10, "Nikhil Tiwari", "202", "Mrs. Rekha Tiwari", "90000 00110"),
  s(11, "Saurabh Dubey", "202", "Mr. Ajay Dubey", "90000 00111"),
  s(12, "Harsh Agarwal", "203", "Mr. Vinod Agarwal", "90000 00112"),
  s(13, "Piyush Jain", "204", "Mrs. Meena Jain", "90000 00113"),
  s(14, "Tarun Chauhan", "204", "Mr. Rakesh Chauhan", "90000 00114"),
  s(15, "Abhishek Pandey", "205", "Mr. Umesh Pandey", "90000 00115"),
];
