import { computed } from 'vue'

type Season = 'winter' | 'spring' | 'summer' | 'autumn'

const SEASON_LOGOS: Record<Season, string> = {
  winter: '/branding/logo-winter.svg',
  spring: '/branding/logo-spring.svg',
  summer: '/branding/logo-summer.svg',
  autumn: '/branding/logo-autumn.svg',
}

function getCurrentSeason(): Season {
  const month = new Date().getMonth() // 0-11
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

export function useSeasonalLogo() {
  const season = computed(() => getCurrentSeason())
  const logoSrc = computed(() => SEASON_LOGOS[season.value])

  return { season, logoSrc }
}
