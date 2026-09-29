<script lang="ts">
  import { t } from '../i18n';
  import { STYLES, type StyleId } from '../style';

  interface Props {
    label: string;
    value: StyleId;
    onchange: (style: StyleId) => void;
  }

  const { label, value, onchange }: Props = $props();

  const LABELS = {
    auto: 'styleAuto',
    formal: 'styleFormal',
    casual: 'styleCasual',
    technical: 'styleTechnical',
    custom: 'styleCustom',
  } as const;
</script>

<label>
  <span class="field-label">{label}</span>
  <select
    {value}
    onchange={(event) => {
      onchange(event.currentTarget.value as StyleId);
    }}
  >
    {#each STYLES as style (style)}
      <option value={style}>{t(LABELS[style])}</option>
    {/each}
  </select>
</label>
