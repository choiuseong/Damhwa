import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

/** 반경 2km 이웃 매칭용 위치 권한/좌표 (실제 매칭은 서버가 좌표로 수행) */
export function useNeighborhood() {
  const [granted, setGranted] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      // 위치를 못 얻어도 앱은 계속 동작
    }
  }, []);

  const request = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    setGranted(res.granted);
    if (res.granted) await load();
    return res.granted;
  }, [load]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((res) => {
      setGranted(res.granted);
      if (res.granted) load();
    });
  }, [load]);

  return { granted, coords, request };
}
