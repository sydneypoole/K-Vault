<template>
  <div class="app-shell">
    <div class="app-bg">
      <header class="topbar card">
        <router-link to="/upload" class="brand-group" aria-label="J-OSS home">
          <span class="brand-mark" aria-hidden="true">KV</span>
          <div class="brand-copy">
            <h1>J-OSS</h1>
            <p>Docker + Cloudflare object relay</p>
          </div>
        </router-link>

        <nav class="nav-row" aria-label="主导航">
          <router-link class="nav-link" to="/upload">Upload</router-link>
          <router-link class="nav-link" to="/drive">Drive</router-link>
          <router-link class="nav-link" to="/storage">Storage</router-link>
          <router-link class="nav-link" to="/status">Status</router-link>
          <a class="nav-link" href="/legacy/index.html" target="_blank" rel="noopener">Legacy</a>
        </nav>

        <div class="topbar-actions">
          <router-link
            v-if="authStore.authRequired && !authStore.authenticated"
            class="btn btn-ghost"
            to="/login"
          >
            Login
          </router-link>
          <button v-if="authStore.authenticated" class="btn btn-ghost" @click="handleLogout">
            Logout
          </button>
        </div>
      </header>

      <section v-if="authStore.guestMode" class="guest-note card">
        <strong>Guest mode enabled.</strong>
        <span>
          Max file size: {{ formatSize(authStore.guestUpload.maxFileSize) }},
          daily limit: {{ authStore.guestUpload.dailyLimit }} uploads.
        </span>
      </section>

      <main class="page-wrap">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();

function formatSize(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

async function handleLogout() {
  try {
    await authStore.logout();
  } finally {
    router.push('/login');
  }
}
</script>
