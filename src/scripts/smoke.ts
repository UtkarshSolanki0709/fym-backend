import { randomUUID } from "crypto";
import { supabase } from "../libs/supabaseClient.js";
import * as profileService from "../services/profile.service.js";

async function runSmokeTest() {
  console.log("🚀 Starting Database and Service Smoke Test...");

  const testEmail = `smoke_${randomUUID().slice(0, 8)}@fym.app`;
  console.log(`[1] Using test email: ${testEmail}`);
  let testUserId = "";
  let photoId = "";

  try {
    // 2. Create user in auth.users (which triggers handle_new_user public.profiles insert)
    console.log("[2] Creating test user in auth.users...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: "password123",
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Auth user creation failed: ${authError?.message || "No user returned"}`);
    }

    testUserId = authData.user.id;
    console.log(`✓ Auth user created successfully. User ID: ${testUserId}`);

    // Wait 1 second to ensure trigger completes profile creation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Update profile fields (display_name, bio, age, geolocation)
    console.log("[3] Updating profile fields (including geolocation lat/lng)...");
    const profileUpdates = {
      display_name: `SmokeUser_${testUserId.slice(0, 8)}`,
      bio: "This is a smoke test bio",
      age: 25,
      geolocation: { lat: 19.0760, lng: 72.8777 } // Mumbai coordinates
    };

    const updatedProfile = await profileService.updateProfile(testUserId, profileUpdates);
    console.log("✓ Profile updated successfully:", {
      id: updatedProfile.id,
      display_name: updatedProfile.display_name,
      geolocation: updatedProfile.geolocation // Should be GeoJSON Point coordinates
    });

    // 4. Update preferences (age_min, age_max, distance_km, gender_preference)
    console.log("[4] Updating user matching preferences...");
    const preferences = {
      age_min: 20,
      age_max: 30,
      distance_km: 100,
      gender_preference: "both"
    };

    const updatedPrefs = await profileService.updatePreferences(testUserId, preferences);
    console.log("✓ Preferences updated successfully:", {
      age_min: updatedPrefs.age_min,
      age_max: updatedPrefs.age_max,
      distance_km: updatedPrefs.distance_km,
      gender_preference: updatedPrefs.gender_preference
    });

    // 5. Update personality quiz
    console.log("[5] Updating onboarding personality quiz answers...");
    const quizAnswers = [
      { question_id: "q1", value: 4 },
      { question_id: "q2", value: 1 },
      { question_id: "q3", value: 5 }
    ];

    const updatedQuiz = await profileService.updateQuiz(testUserId, quizAnswers);
    console.log("✓ Quiz updated successfully. Answers count:", updatedQuiz?.length);

    // 6. Append photo (mock base64)
    console.log("[6] Testing addPhoto (uploads to Supabase Storage & appends to database)...");
    // Small 1x1 transparent pixel base64 GIF
    const mockBase64Image = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    try {
      const photoResult = await profileService.addPhoto(testUserId, mockBase64Image);
      photoId = photoResult.id;
      console.log("✓ Photo added successfully:", photoResult);
    } catch (photoError: any) {
      console.warn("⚠️ Photo upload failed:", photoError.message);
    }

    // 7. Read back profile
    console.log("[7] Reading back complete profile from database...");
    const finalProfile = await profileService.getProfile(testUserId);
    console.log("✓ Full profile fetched successfully:", {
      id: finalProfile.id,
      display_name: finalProfile.display_name,
      age: finalProfile.age,
      trust_score: finalProfile.trust_score,
      geolocation: finalProfile.geolocation,
      photos: finalProfile.photos,
      interests: finalProfile.interests,
      prompts: finalProfile.prompts,
      quiz: finalProfile.quiz,
      age_min: finalProfile.age_min,
      age_max: finalProfile.age_max,
      distance_km: finalProfile.distance_km,
      gender_preference: finalProfile.gender_preference
    });

  } catch (error: any) {
    console.error("\n❌ SMOKE TEST FAILED!");
    console.error(error);
  } finally {
    // 8. Clean up test data
    console.log("[8] Cleaning up test data...");
    if (testUserId) {
      if (photoId) {
        try {
          await profileService.deletePhoto(testUserId, photoId);
          console.log("✓ Test photo deleted successfully from Supabase Storage.");
        } catch (e: any) {
          console.warn("⚠️ Photo delete failed during cleanup:", e.message);
        }
      }
      
      const { error: deleteError } = await supabase.auth.admin.deleteUser(testUserId);
      if (deleteError) {
        console.warn("⚠️ Clean up delete failed:", deleteError.message);
      } else {
        console.log("✓ Clean up completed successfully (auth user + profile deleted).");
      }
    }
    
    console.log("\n🎉 Smoke test script run completed.");
  }
}

// Execute smoke test if run directly
if (process.argv[1]?.endsWith("smoke.ts") || process.argv[1]?.endsWith("smoke.js")) {
  runSmokeTest();
}
