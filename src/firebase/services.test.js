// src/firebase/services.test.js
import { registerUser, createReport } from "./services";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { addDoc, getDocs } from "firebase/firestore";
import { uploadBytes, getDownloadURL } from "firebase/storage";

// ─── Firebase Mocks ──────────────────────────────────────────────────────────
jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock("./config", () => ({
  db: {},
  auth: {},
  storage: {},
  messaging: {},
}));

describe("White Box Testing - Services Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 5.2.1 User Authentication Module (registerUser) ───────────────────────
  describe("registerUser() - Branch Coverage", () => {
    
    // Path 1: Invalid email domain restriction check
    test("Path 1 (Failure): Should reject registrations with non-MEC email domains", async () => {
      await expect(
        registerUser("John Doe", "john@gmail.com", "password123", "supervisor")
      ).rejects.toThrow('Registration is restricted to MEC\'S staff');
      
      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    // Path 2: Valid domain, Admin registration (Status approved, no notifications sent)
    test("Path 2 (Success): Admin registration - Sets approved status and bypasses notification logic", async () => {
      const mockUser = { uid: "admin123", delete: jest.fn() };
      createUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      updateProfile.mockResolvedValueOnce();
      addDoc.mockResolvedValueOnce({ id: "doc123" });

      const result = await registerUser("Admin User", "admin@mecs.com.my", "password123", "admin");

      expect(createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: "Admin User" });
      
      // Verify Firestore payload matches approved admin state
      expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
        uid: "admin123",
        role: "admin",
        status: "approved",
      }));
      expect(getDocs).not.toHaveBeenCalled(); // No admin search for notifications
      expect(result).toBe(mockUser);
    });

    // Path 3: Valid domain, Supervisor/Consultant registration (Status pending, notifies admins)
    test("Path 3 (Success): Supervisor registration - Sets pending status and triggers notifications to admins", async () => {
      const mockUser = { uid: "super123", delete: jest.fn() };
      const mockAdminDoc = { data: () => ({ uid: "adminUid" }) };
      
      createUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      updateProfile.mockResolvedValueOnce();
      addDoc.mockResolvedValueOnce({ id: "doc123" }); // Save user document
      getDocs.mockResolvedValueOnce({ docs: [mockAdminDoc] }); // Search admins query

      const result = await registerUser("Site Super", "super@mecs.com.my", "password123", "supervisor");

      expect(addDoc).toHaveBeenNthCalledWith(1, undefined, expect.objectContaining({
        uid: "super123",
        role: "supervisor",
        status: "pending",
      }));
      expect(getDocs).toHaveBeenCalled(); // Should fetch existing admins
      expect(addDoc).toHaveBeenNthCalledWith(2, undefined, expect.objectContaining({
        recipientUid: "adminUid",
        message: expect.stringContaining("New Site Supervisor registration pending approval"),
      }));
      expect(result).toBe(mockUser);
    });

    // Path 4: Firestore database write failure (Deletes Auth account & rolls back)
    test("Path 4 (Failure): Database write fails - Deletes user from Firebase Auth and propagates error", async () => {
      const mockUser = { uid: "fail123", delete: jest.fn().mockResolvedValue() };
      createUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      updateProfile.mockResolvedValueOnce();
      addDoc.mockRejectedValueOnce(new Error("Firestore offline"));

      await expect(
        registerUser("Jane Doe", "jane@mecs.com.my", "password123", "supervisor")
      ).rejects.toThrow("Firestore offline");

      expect(mockUser.delete).toHaveBeenCalled(); // Verification of clean rollback
    });
  });

  // ─── 5.2.2 & 5.2.6 Daily Report & Storage Integration (createReport) ─────────
  describe("createReport() - Loop & Storage Integration Coverage", () => {
    
    // Path 1: Creating a report with 0 files (loop skipped)
    test("Path 1: Report creation with no attached files (loop runs 0 times)", async () => {
      addDoc.mockResolvedValueOnce({ id: "report123" });

      const reportData = { title: "Daily Trench Excavation", projectId: "proj1" };
      await createReport(reportData, []);

      expect(uploadBytes).not.toHaveBeenCalled();
      expect(getDownloadURL).not.toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
        ...reportData,
        photoUrls: [],
        status: "pending",
      }));
    });

    // Path 2: Creating a report with multiple files (loop execution and storage integration)
    test("Path 2: Report creation with evidence photos (loop runs N times, calls Firebase Storage)", async () => {
      const mockFiles = [
        { name: "photo1.png" },
        { name: "photo2.png" }
      ];
      uploadBytes.mockResolvedValue({});
      getDownloadURL
        .mockResolvedValueOnce("https://storage.googleapis.com/photo1_url")
        .mockResolvedValueOnce("https://storage.googleapis.com/photo2_url");
      addDoc.mockResolvedValueOnce({ id: "report456" });

      const reportData = { title: "Foundation Concrete Pouring", projectId: "proj1" };
      await createReport(reportData, mockFiles);

      // Verify Firebase Storage was called for both files
      expect(uploadBytes).toHaveBeenCalledTimes(2);
      expect(getDownloadURL).toHaveBeenCalledTimes(2);
      
      // Verify firestore record contains both generated storage links
      expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
        ...reportData,
        photoUrls: [
          "https://storage.googleapis.com/photo1_url",
          "https://storage.googleapis.com/photo2_url"
        ],
        status: "pending",
      }));
    });
  });
});
