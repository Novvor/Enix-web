import { useId } from "react";
import type { ENIXMood } from "./ENIXMascot";
import "./EnixMascotAnimatedSvg.css";

interface EnixMascotAnimatedSvgProps {
  mood?: ENIXMood;
}

/**
 * Official ENIX mascot artwork (from public/brand/enix-mascot.svg) rendered with
 * scoped gradient IDs and smooth CSS rig animations (float, blink, wave, flame sway)
 * reacting to real ENIX_MOOD states. Automatically yields to WebGL2 Rive when .riv is present.
 */
export function EnixMascotAnimatedSvg({ mood = 0 }: EnixMascotAnimatedSvgProps) {
  const uid = useId().replace(/:/g, "");
  const gBody = `enix-body-${uid}`;
  const gTop = `enix-top-${uid}`;
  const gMid = `enix-mid-${uid}`;
  const gBack = `enix-back-${uid}`;
  const gArm = `enix-arm-${uid}`;
  const gFeet = `enix-feet-${uid}`;
  const gEye = `enix-eye-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className="enix-svg-mascot"
      data-mood={mood}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gBody} x1="171" y1="244" x2="325" y2="430" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF9B65" />
          <stop offset=".38" stopColor="#FF704C" />
          <stop offset=".76" stopColor="#FF542F" />
          <stop offset="1" stopColor="#DF3D25" />
        </linearGradient>
        <linearGradient id={gTop} x1="194" y1="103" x2="299" y2="183" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB17A" />
          <stop offset=".43" stopColor="#FF8256" />
          <stop offset=".8" stopColor="#FF5B38" />
          <stop offset="1" stopColor="#D93D28" />
        </linearGradient>
        <linearGradient id={gMid} x1="187" y1="185" x2="293" y2="248" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFA472" />
          <stop offset=".5" stopColor="#FF7952" />
          <stop offset=".82" stopColor="#FF5936" />
          <stop offset="1" stopColor="#D83B26" />
        </linearGradient>
        <linearGradient id={gBack} x1="301" y1="197" x2="364" y2="307" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF9666" />
          <stop offset=".5" stopColor="#FF6744" />
          <stop offset="1" stopColor="#D43C28" />
        </linearGradient>
        <linearGradient id={gArm} x1="-12" y1="-5" x2="20" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF9967" />
          <stop offset=".5" stopColor="#FF7750" />
          <stop offset="1" stopColor="#EA4D2F" />
        </linearGradient>
        <linearGradient id={gFeet} x1="0" y1="-9" x2="5" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8659" />
          <stop offset="1" stopColor="#EC4E30" />
        </linearGradient>
        <linearGradient id={gEye} x1="0" y1="-23" x2="12" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#301B3C" />
          <stop offset="1" stopColor="#4C2043" />
        </linearGradient>
      </defs>

      <g className="enix-rig-shadow" transform="translate(256 461)">
        <ellipse rx="91" ry="11" fill="#301B3C" opacity=".1" />
        <ellipse rx="67" ry="7" fill="#301B3C" opacity=".08" />
      </g>

      <g className="enix-rig-body">
        <g transform="translate(217 437)">
          <ellipse rx="30" ry="15" fill={`url(#${gFeet})`} />
        </g>
        <g transform="translate(289 438)">
          <ellipse rx="30" ry="14" fill={`url(#${gFeet})`} />
        </g>

        <path
          className="enix-rig-flame-back"
          d="M290 316C311 295 331 258 333 225C334 210 331 198 327 187C363 201 381 237 371 267C360 300 331 316 290 316Z"
          fill={`url(#${gBack})`}
        />

        <path
          d="M157 265C169 230 198 216 236 211C278 206 332 202 345 245C358 287 364 331 350 370C337 411 310 435 261 438C214 441 181 419 166 384C150 346 142 303 157 265Z"
          fill={`url(#${gBody})`}
        />
        <path
          d="M158 282C162 255 184 236 209 230C180 251 168 284 170 317C171 340 176 358 185 374C162 349 150 311 158 282Z"
          fill="#FFC49A"
          opacity=".2"
        />

        <g className="enix-rig-flame-top">
          <path
            d="M161 211C171 172 208 147 256 139C301 132 322 117 327 95C345 113 346 137 322 153C292 174 219 160 181 198Z"
            fill="#D9412B"
            opacity=".85"
          />
          <path
            d="M158 215C146 183 154 146 183 123C214 99 258 106 287 87C305 75 313 56 303 41C334 46 351 77 346 103C338 143 299 148 257 156C211 164 177 187 158 215Z"
            fill={`url(#${gTop})`}
          />
          <path
            d="M169 173C180 145 207 126 239 119C267 113 300 103 311 85C303 107 269 119 242 125C208 132 185 148 169 173Z"
            fill="#FFC799"
            opacity=".18"
          />
          <path
            d="M149 269C180 226 214 220 254 217C295 214 327 200 341 178C349 205 328 228 298 233C247 241 207 226 174 253Z"
            fill="#D43C28"
            opacity=".65"
          />
          <path
            d="M145 283C136 249 146 216 173 194C204 168 247 167 284 161C318 156 341 140 343 116C365 134 371 159 357 181C340 210 306 215 264 215C218 215 174 236 145 283Z"
            fill={`url(#${gMid})`}
          />
          <path
            d="M156 247C170 213 197 194 228 185C262 175 293 177 319 164C304 180 267 181 237 190C200 200 176 217 156 247Z"
            fill="#FFD2AB"
            opacity=".18"
          />
        </g>

        <g className="enix-rig-arm-left" transform="translate(165 326)">
          <g transform="rotate(28)">
            <ellipse cx="-5" cy="24" rx="18" ry="35" fill={`url(#${gArm})`} />
          </g>
        </g>

        <g className="enix-rig-arm-right" transform="translate(341 328)">
          <g className="enix-rig-arm-right-wave">
            <ellipse cx="5" cy="24" rx="18" ry="35" fill={`url(#${gArm})`} />
          </g>
        </g>

        <g className="enix-rig-face" transform="translate(254 303)">
          <g transform="translate(-43 -5) rotate(8)">
            <g className="enix-rig-eye">
              <ellipse rx="15" ry="24" fill={`url(#${gEye})`} />
              <ellipse cx="5" cy="-12" rx="4.5" ry="6.5" fill="#FFF3DC" />
            </g>
          </g>
          <g transform="translate(43 -2) rotate(8)">
            <g className="enix-rig-eye">
              <ellipse rx="15" ry="24" fill={`url(#${gEye})`} />
              <ellipse cx="5" cy="-12" rx="4.5" ry="6.5" fill="#FFF3DC" />
            </g>
          </g>
          <g transform="translate(1 23)">
            <path
              d="M-15 0C-8 12 8 12 15 0"
              fill="none"
              stroke="#3C1D3D"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
          </g>
          <ellipse cx="-63" cy="21" rx="12" ry="5.5" fill="#DD4235" opacity=".24" />
          <ellipse cx="64" cy="23" rx="12" ry="5.5" fill="#DD4235" opacity=".24" />
        </g>
      </g>
    </svg>
  );
}
