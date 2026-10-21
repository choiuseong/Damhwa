import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { PREVIEW_MODE } from '../api/config';
import { showDialog } from '../lib/dialog';
import { PREVIEW_COORDS } from '../preview/mockData';

/** 개인정보 보호: 서버로 보낼 좌표는 소수 셋째 자리(약 100m)까지만 사용 */
const round = (v: number) => Math.round(v * 1000) / 1000;

/** 반경 2km 이웃 매칭용 위치 권한/좌표 (실제 매칭은 서버가 좌표로 수행) */
export function useNeighborhood() {
  const [granted, setGranted] = useState(PREVIEW_MODE);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(PREVIEW_MODE ? PREVIEW_COORDS : null);

  const load = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      setCoords({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
    } catch {
      // 위치를 못 얻어도 앱은 계속 동작 (공용 채팅방은 위치 없이도 보임)
    }
  }, []);

  /**
   * @param explain true 면 거절됐을 때 쉬운 말로 안내창을 띄움 (사용자가 '허용하기'를 직접 눌렀을 때)
   */
  const request = useCallback(async (explain = false) => {
    if (PREVIEW_MODE) return true; // 미리보기: 가짜 위치 사용
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setGranted(res.granted);
      if (res.granted) await load();
      else if (explain) {
        showDialog(
          '위치를 쓸 수 없어요',
          res.canAskAgain
            ? '위치를 허용하면 가까운 이웃의 채팅방이 보여요. 위치 없이도 공용 채팅방은 그대로 쓸 수 있어요.'
            : '휴대폰 설정 → 담화 → 위치에서 "허용"으로 바꿔 주세요. 위치 없이도 공용 채팅방은 그대로 쓸 수 있어요.',
        );
      }
      return res.granted;
    } catch {
      if (explain) showDialog('위치를 확인하지 못했어요', '잠시 후 다시 눌러 주세요. 공용 채팅방은 그대로 쓸 수 있어요.');
      return false;
    }
  }, [load]);

  useEffect(() => {
    if (PREVIEW_MODE) return;
    Location.getForegroundPermissionsAsync()
      .then((res) => {
        setGranted(res.granted);
        if (res.granted) load();
      })
      .catch(() => setGranted(false));
  }, [load]);

  return { granted, coords, request };
}
