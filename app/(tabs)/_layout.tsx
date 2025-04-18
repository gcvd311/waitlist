import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/constants/colors";
import { Home, ListPlus, Menu } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Waitlist",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size-2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add Item",
          tabBarLabel: "Add",
          tabBarIcon: ({ color, size }) => (
            <ListPlus size={size-2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarLabel: "Menu",
          tabBarIcon: ({ color, size }) => (
            <Menu size={size-2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}