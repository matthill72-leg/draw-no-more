import axios from 'axios';
import { encode } from 'plantuml-encoder';

/**
 * Render PlantUML text to SVG by using the PlantUML server.
 * Encodes the diagram text and fetches the SVG.
 *
 * For production or privacy-sensitive data, self-host PlantUML or proxy requests.
 */
export async function renderPlantUMLToSVG(
  plantUmlText: string,
  serverUrl = process.env.PLANTUML_SERVER_URL || 'https://www.plantuml.com/plantuml'
): Promise<string> {
  const encoded = encode(plantUmlText);
  const url = `${serverUrl.replace(/\/$/, '')}/svg/${encoded}`;
  const res = await axios.get(url, { responseType: 'text' });
  return res.data;
}
