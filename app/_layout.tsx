import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { ErrorBoundary } from "./error-boundary";
import { colors } from "@/constants/colors";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <RootLayoutNav />
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: colors.card,
        },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="item/[id]" 
        options={{ 
          title: "Item Details",
          headerBackTitle: "Back",
        }} 
      />
      <Stack.Screen 
        name="item/edit" 
        options={{ 
          title: "Edit Item",
          headerBackTitle: "Back",
          presentation: "modal",
        }} 
      />
      <Stack.Screen 
        name="item/price-log" 
        options={{ 
          title: "Price Log",
          headerBackTitle: "Back",
          presentation: "modal",
        }} 
      />
      <Stack.Screen 
        name="item/girl-math" 
        options={{ 
          title: "Girl Math",
          headerBackTitle: "Back",
          presentation: "modal",
        }} 
      />
      <Stack.Screen 
        name="category/index" 
        options={{ 
          title: "Browse by Category",
          headerBackTitle: "Back",
        }} 
      />
      <Stack.Screen 
        name="purchased/index" 
        options={{ 
          title: "Purchased Items",
          headerBackTitle: "Back",
        }} 
      />
      <Stack.Screen 
        name="girl-math/index" 
        options={{ 
          title: "Girl Math Tracker",
          headerBackTitle: "Back",
        }} 
      />
      <Stack.Screen 
        name="girl-math/add" 
        options={{ 
          title: "Add Justification",
          headerBackTitle: "Back",
          presentation: "modal",
        }} 
      />
    </Stack>
  );
}