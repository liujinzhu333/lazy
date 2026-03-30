<template>
  <!-- 应用根容器：全屏布局，路由视图出口 -->
  <div id="root-app">
    <router-view />
  </div>
</template>

<script setup>
// App.vue 仅作为路由出口容器，无业务逻辑
</script>

<style>
/* 根容器全屏撑满 */
#root-app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
